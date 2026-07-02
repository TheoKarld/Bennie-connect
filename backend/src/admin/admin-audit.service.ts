import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AdminAuditLog,
  AdminAuditLogDocument,
} from './schemas/admin-audit-log.schema';

export interface AuditEntry {
  actorId?: any;
  actorEmail: string;
  action: string;
  permission?: string;
  resource: string;
  targetId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectModel(AdminAuditLog.name)
    private readonly auditModel: Model<AdminAuditLogDocument>,
  ) {}

  /**
   * Append an entry to the (append-only) admin audit log. Failures are logged
   * but never propagated — auditing must not break the primary action.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create(entry);
    } catch (error: any) {
      this.logger.error(
        `Failed to write admin audit log (${entry.action}): ${error?.message}`,
      );
    }
  }
}
