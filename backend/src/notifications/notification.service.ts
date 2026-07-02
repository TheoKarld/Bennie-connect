import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationPriority,
  NotificationRecipientType,
  NotificationType,
} from './schemas/notification.schema';
import {
  DeviceToken,
  DeviceTokenDocument,
} from './schemas/device-token.schema';
import {
  AdminUser,
  AdminUserDocument,
} from '../admin/schemas/admin-user.schema';
import { FcmService } from './fcm.service';
import { NotificationGateway } from './notification.gateway';

export interface NotifyInput {
  recipientType: NotificationRecipientType;
  recipientId: string | Types.ObjectId;
  event: string;
  type?: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
}

export interface NotifyAdminsInput {
  event: string;
  type?: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface RecipientRef {
  recipientType: NotificationRecipientType;
  recipientId: string;
}

/**
 * One service fronting two transports: socket.io (in-app) and FCM (web push).
 * Every channel is best-effort — persistence to Mongo is the source of truth,
 * and socket/FCM failures are logged, never thrown, and never block the caller.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceTokenDocument>,
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    private readonly fcmService: FcmService,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly gateway: NotificationGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // Delivery
  // ---------------------------------------------------------------------------

  /**
   * Persist a notification, emit it over socket to the recipient room, then
   * push to that recipient's device tokens via FCM. Best-effort per channel.
   */
  async notify(input: NotifyInput): Promise<NotificationDocument | null> {
    let doc: NotificationDocument;
    try {
      doc = await this.notificationModel.create({
        recipientType: input.recipientType,
        recipientId: new Types.ObjectId(input.recipientId),
        event: input.event,
        type: input.type || 'info',
        title: input.title,
        body: input.body,
        data: input.data || {},
        priority: input.priority || 'normal',
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to persist notification "${input.event}": ${error?.message}`,
      );
      return null;
    }

    const recipientId = doc.recipientId.toString();

    // Socket emit (best-effort).
    try {
      this.emitToRecipient(
        input.recipientType,
        recipientId,
        'notification:new',
        {
          notification: doc.toObject(),
        },
      );
      const count = await this.unreadCount(input.recipientType, recipientId);
      this.emitToRecipient(
        input.recipientType,
        recipientId,
        'notification:unread_count',
        { count },
      );
    } catch (error: any) {
      this.logger.warn(`Socket emit failed: ${error?.message}`);
    }

    // FCM push (best-effort).
    this.pushToRecipient(input.recipientType, recipientId, {
      title: input.title,
      body: input.body,
      data: this.flattenData({ event: input.event, ...(input.data || {}) }),
    }).catch((error: any) =>
      this.logger.warn(`FCM push failed: ${error?.message}`),
    );

    return doc;
  }

  /**
   * Fan out a notification to every active, non-banned admin: persist one per
   * admin, emit to the shared `admins` room, and multicast FCM to all admin
   * device tokens. Best-effort per channel.
   */
  async notifyAdmins(input: NotifyAdminsInput): Promise<void> {
    let admins: Array<{ _id: Types.ObjectId }> = [];
    try {
      admins = await this.adminUserModel
        .find({ isActive: true, isBanned: { $ne: true } })
        .select('_id')
        .lean();
    } catch (error: any) {
      this.logger.error(`Failed to resolve admins: ${error?.message}`);
      return;
    }

    if (admins.length === 0) {
      this.logger.warn(
        `notifyAdmins("${input.event}") — no active admins to notify`,
      );
    }

    const type = input.type || 'info';
    const priority = input.priority || 'normal';

    // Persist one notification per admin.
    for (const admin of admins) {
      try {
        await this.notificationModel.create({
          recipientType: 'admin',
          recipientId: admin._id,
          event: input.event,
          type,
          title: input.title,
          body: input.body,
          data: input.data || {},
          priority,
        });
      } catch (error: any) {
        this.logger.warn(
          `Failed to persist admin notification for ${admin._id.toString()}: ${error?.message}`,
        );
      }
    }

    // Emit to the shared admins room (best-effort).
    try {
      this.gateway.emitToAllAdmins('notification:new', {
        notification: {
          recipientType: 'admin',
          event: input.event,
          type,
          title: input.title,
          body: input.body,
          data: input.data || {},
          priority,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Admin socket fan-out failed: ${error?.message}`);
    }

    // FCM multicast to all admin device tokens (best-effort).
    try {
      const tokens = await this.deviceTokenModel
        .find({ recipientType: 'admin' })
        .select('token')
        .lean();
      const tokenList = tokens.map((t) => t.token).filter(Boolean);
      if (tokenList.length > 0) {
        const result = await this.fcmService.sendToTokens(tokenList, {
          title: input.title,
          body: input.body,
          data: this.flattenData({ event: input.event, ...(input.data || {}) }),
        });
        await this.pruneInvalidTokens(result.invalidTokens);
      }
    } catch (error: any) {
      this.logger.warn(`Admin FCM multicast failed: ${error?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Query + read state
  // ---------------------------------------------------------------------------

  async list(
    recipientType: NotificationRecipientType,
    recipientId: string | Types.ObjectId,
    options: ListOptions = {},
  ): Promise<{
    items: NotificationDocument[];
    total: number;
    page: number;
    limit: number;
    unreadCount: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      recipientType,
      recipientId: new Types.ObjectId(recipientId),
    };
    if (options.unreadOnly) {
      filter.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        recipientType,
        recipientId: new Types.ObjectId(recipientId),
        isRead: false,
      }),
    ]);

    return { items: items as any, total, page, limit, unreadCount };
  }

  async unreadCount(
    recipientType: NotificationRecipientType,
    recipientId: string | Types.ObjectId,
  ): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientType,
      recipientId: new Types.ObjectId(recipientId),
      isRead: false,
    });
  }

  async markRead(
    id: string,
    recipient: RecipientRef,
  ): Promise<{ updated: boolean; unreadCount: number }> {
    if (!Types.ObjectId.isValid(id)) {
      return {
        updated: false,
        unreadCount: await this.unreadCount(
          recipient.recipientType,
          recipient.recipientId,
        ),
      };
    }
    const res = await this.notificationModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        recipientType: recipient.recipientType,
        recipientId: new Types.ObjectId(recipient.recipientId),
        isRead: false,
      },
      { $set: { isRead: true, readAt: new Date() } },
    );
    const unreadCount = await this.unreadCount(
      recipient.recipientType,
      recipient.recipientId,
    );
    this.emitUnreadCount(recipient, unreadCount);
    return { updated: res.modifiedCount > 0, unreadCount };
  }

  async markAllRead(
    recipient: RecipientRef,
  ): Promise<{ updated: number; unreadCount: number }> {
    const res = await this.notificationModel.updateMany(
      {
        recipientType: recipient.recipientType,
        recipientId: new Types.ObjectId(recipient.recipientId),
        isRead: false,
      },
      { $set: { isRead: true, readAt: new Date() } },
    );
    this.emitUnreadCount(recipient, 0);
    return { updated: res.modifiedCount, unreadCount: 0 };
  }

  // ---------------------------------------------------------------------------
  // Device tokens
  // ---------------------------------------------------------------------------

  async registerDeviceToken(
    recipient: RecipientRef,
    token: string,
    userAgent?: string,
  ): Promise<DeviceTokenDocument> {
    return this.deviceTokenModel.findOneAndUpdate(
      { token },
      {
        $set: {
          recipientType: recipient.recipientType,
          recipientId: new Types.ObjectId(recipient.recipientId),
          userAgent,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async removeDeviceToken(
    recipient: RecipientRef,
    token: string,
  ): Promise<{ removed: boolean }> {
    const res = await this.deviceTokenModel.deleteOne({
      token,
      recipientType: recipient.recipientType,
      recipientId: new Types.ObjectId(recipient.recipientId),
    });
    return { removed: res.deletedCount > 0 };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private emitToRecipient(
    recipientType: NotificationRecipientType,
    recipientId: string,
    event: string,
    data: any,
  ): void {
    if (recipientType === 'admin') {
      this.gateway.emitToAdmin(recipientId, event, data);
    } else {
      this.gateway.emitToUser(recipientId, event, data);
    }
  }

  private emitUnreadCount(recipient: RecipientRef, count: number): void {
    try {
      this.emitToRecipient(
        recipient.recipientType,
        recipient.recipientId,
        'notification:unread_count',
        { count },
      );
    } catch (error: any) {
      this.logger.warn(`unread_count emit failed: ${error?.message}`);
    }
  }

  private async pushToRecipient(
    recipientType: NotificationRecipientType,
    recipientId: string,
    payload: { title: string; body: string; data: Record<string, string> },
  ): Promise<void> {
    const tokens = await this.deviceTokenModel
      .find({
        recipientType,
        recipientId: new Types.ObjectId(recipientId),
      })
      .select('token')
      .lean();
    const tokenList = tokens.map((t) => t.token).filter(Boolean);
    if (tokenList.length === 0) {
      return;
    }
    const result = await this.fcmService.sendToTokens(tokenList, payload);
    await this.pruneInvalidTokens(result.invalidTokens);
  }

  private async pruneInvalidTokens(tokens: string[]): Promise<void> {
    if (!tokens || tokens.length === 0) {
      return;
    }
    try {
      await this.deviceTokenModel.deleteMany({ token: { $in: tokens } });
    } catch (error: any) {
      this.logger.warn(`Failed to prune invalid tokens: ${error?.message}`);
    }
  }

  /** FCM `data` payloads must be string→string. */
  private flattenData(data: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value === undefined || value === null) {
        continue;
      }
      out[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return out;
  }
}
