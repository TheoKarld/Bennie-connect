import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import {
  MerchantEarning,
  MerchantEarningDocument,
} from './schemas/merchant-earning.schema';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notifications/notification.service';
import { MarketplaceService } from './marketplace.service';
import {
  FULFILLMENT_FLOW,
  MarketplaceException,
  MKT_EVENTS,
} from './marketplace.constants';
import { computePlatformFee, toObjectId } from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import { CancelOrderDto, ListMyOrdersDto } from './dto/marketplace.dto';

/**
 * Buyer order surface (cart_checkout.md §3.5–§3.8) + the shared order
 * machinery reused by the merchant and admin planes: forward-only transition
 * validation, exactly-once earnings booking at DELIVERED, restock, and the
 * cancel-with-mandatory-refund path (`MKTREF<orderId>`, idempotent).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(MerchantEarning.name)
    private readonly earningModel: Model<MerchantEarningDocument>,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /** Batch user display info by users._id string. */
  async userMap(
    ids: (string | Types.ObjectId)[],
  ): Promise<Map<string, { name: string; phone?: string; userId?: string }>> {
    const unique = Array.from(new Set(ids.map((i) => i.toString()))).filter(
      (i) => Types.ObjectId.isValid(i),
    );
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.connection
      .collection('users')
      .find(
        { _id: { $in: unique.map((i) => new Types.ObjectId(i)) } },
        {
          projection: { firstName: 1, lastName: 1, phoneNumber: 1, userId: 1 },
        },
      )
      .toArray();
    return new Map(
      rows.map((u: any) => [
        u._id.toString(),
        {
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Member',
          phone: u.phoneNumber,
          userId: u.userId,
        },
      ]),
    );
  }

  /** Buyer-safe display name: first name + last initial. */
  buyerDisplayName(info?: { name: string }): string {
    if (!info?.name) {
      return 'Member';
    }
    const [first, ...rest] = info.name.split(' ');
    const initial = rest.length ? ` ${rest[rest.length - 1].charAt(0)}.` : '';
    return `${first}${initial}`;
  }

  async sellerCard(order: any): Promise<Record<string, any>> {
    if (order.seller?.type === 'MERCHANT' && order.seller.merchantId) {
      const names = await this.marketplaceService.merchantNameMap([
        order.seller.merchantId,
      ]);
      const mid = order.seller.merchantId.toString();
      return {
        type: 'MERCHANT',
        merchantId: mid,
        displayName: names.get(mid) || 'Merchant',
      };
    }
    return {
      type: 'PLATFORM',
      displayName: this.marketplaceService.platformStoreName,
    };
  }

  /**
   * Serialize an order with the user-PRD compatibility aliases
   * (`status` = fulfillmentStatus, `totalAmount` = pricing.total,
   * `confirmedReceivedAt` = buyerConfirmedAt) alongside the canonical fields.
   */
  orderView(order: any, seller?: Record<string, any>): Record<string, any> {
    const plain = serialize<any>(order);
    return {
      ...plain,
      ...(seller ? { seller } : {}),
      status: plain.fulfillmentStatus,
      totalAmount: plain.pricing?.total,
      platformFeePercent: plain.pricing?.platformFeePercent,
      platformFee: plain.pricing?.platformFee,
      merchantNet: plain.pricing?.merchantNet,
      confirmedReceivedAt: plain.buyerConfirmedAt ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Shared machinery
  // ---------------------------------------------------------------------------

  /** The single allowed next step, or null when terminal. */
  nextForwardStatus(current: string): string | null {
    const idx = FULFILLMENT_FLOW.indexOf(current as any);
    if (idx < 0 || idx + 1 >= FULFILLMENT_FLOW.length) {
      return null;
    }
    return FULFILLMENT_FLOW[idx + 1];
  }

  flowIndex(status: string): number {
    return FULFILLMENT_FLOW.indexOf(status as any);
  }

  /** Restore each item's quantity to inventory.available (best-effort). */
  async restockOrderItems(order: OrderDocument | any): Promise<void> {
    for (const item of order.items || []) {
      try {
        await this.productModel.updateOne(
          { _id: item.productId },
          { $inc: { 'inventory.available': item.quantity } },
        );
      } catch (error: any) {
        this.logger.error(
          `Restock failed for product ${item.productId}: ${error?.message}`,
        );
      }
    }
  }

  /**
   * Book the merchant's net share at DELIVERED — exactly once, guarded by the
   * `earningsBooked` flag AND the unique partial index on
   * merchantEarnings.orderId. Also consumes `totalSales`.
   */
  async bookEarningsIfNeeded(order: OrderDocument): Promise<void> {
    if (order.seller?.type !== 'MERCHANT' || !order.seller.merchantId) {
      // PLATFORM orders book no earnings; still consume totalSales.
      await this.consumeTotalSales(order);
      return;
    }
    const claimed = await this.orderModel.findOneAndUpdate(
      { _id: order._id, earningsBooked: false },
      { $set: { earningsBooked: true } },
      { new: false },
    );
    if (!claimed || claimed.earningsBooked) {
      return; // already booked
    }

    const gross = order.pricing.total;
    const feePercent = order.pricing.platformFeePercent || 0;
    const platformFee =
      order.pricing.platformFee ?? computePlatformFee(gross, feePercent);
    const net = order.pricing.merchantNet ?? gross - platformFee;

    try {
      await this.earningModel.create({
        merchantId: order.seller.merchantId,
        type: 'ORDER_EARNING',
        orderId: order._id,
        orderNumber: order.orderNumber,
        gross,
        platformFeePercent: feePercent,
        platformFee,
        net,
        status: 'AVAILABLE',
        bookedAt: new Date(),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return; // unique-orderId backstop — a parallel booking won
      }
      // Roll the claim back so a retry can book.
      await this.orderModel.updateOne(
        { _id: order._id },
        { $set: { earningsBooked: false } },
      );
      throw error;
    }

    await this.merchantModel.updateOne(
      { _id: order.seller.merchantId },
      {
        $inc: {
          'earnings.availableBalance': net,
          'earnings.lifetimeEarned': net,
        },
      },
    );
    await this.consumeTotalSales(order);
  }

  private async consumeTotalSales(order: OrderDocument | any): Promise<void> {
    for (const item of order.items || []) {
      try {
        await this.productModel.updateOne(
          { _id: item.productId },
          { $inc: { totalSales: item.quantity } },
        );
      } catch (error: any) {
        this.logger.warn(
          `totalSales update failed for ${item.productId}: ${error?.message}`,
        );
      }
    }
  }

  /** Notify the buyer of a fulfilment advance (order.status). */
  async notifyBuyerStatus(order: OrderDocument | any): Promise<void> {
    try {
      const orderId = order._id.toString();
      await this.notificationService.notify({
        recipientType: 'user',
        recipientId: order.buyerId,
        event: MKT_EVENTS.ORDER_STATUS,
        type: order.fulfillmentStatus === 'DELIVERED' ? 'success' : 'info',
        title: `Order ${order.fulfillmentStatus.toLowerCase()}`,
        body: `Order ${order.orderNumber} is now ${order.fulfillmentStatus}.`,
        data: {
          orderId,
          orderNumber: order.orderNumber,
          status: order.fulfillmentStatus,
          link: `/app/marketplace/orders/${orderId}`,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Buyer status notification failed: ${error?.message}`);
    }
  }

  /** Notify the seller (merchant user, or admins for PLATFORM orders). */
  async notifySeller(
    order: OrderDocument | any,
    input: { event: string; type?: any; title: string; body: string },
  ): Promise<void> {
    try {
      const orderId = order._id.toString();
      if (order.seller?.type === 'MERCHANT' && order.seller.merchantId) {
        const merchant = await this.merchantModel
          .findById(order.seller.merchantId)
          .select('userId')
          .lean();
        if (merchant?.userId) {
          await this.notificationService.notify({
            recipientType: 'user',
            recipientId: (merchant as any).userId,
            event: input.event,
            type: input.type || 'info',
            title: input.title,
            body: input.body,
            data: {
              orderId,
              orderNumber: order.orderNumber,
              link: `/app/merchant?tab=orders`,
            },
          });
        }
      } else {
        await this.notificationService.notifyAdmins({
          event: input.event,
          type: input.type || 'info',
          title: input.title,
          body: input.body,
          data: {
            orderId,
            orderNumber: order.orderNumber,
            link: `/bennie/orders/${orderId}`,
          },
        });
      }
    } catch (error: any) {
      this.logger.warn(`Seller notification failed: ${error?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Buyer endpoints
  // ---------------------------------------------------------------------------

  /** GET /marketplace/orders — grouped by checkoutGroupId, newest first. */
  async listMyOrders(
    userId: string,
    query: ListMyOrdersDto,
  ): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const buyerId = new Types.ObjectId(userId);

    const groupMatch: Record<string, any> = { buyerId };
    if (query.status) {
      groupMatch.fulfillmentStatus = query.status;
    }

    const grouped = await this.orderModel.aggregate([
      { $match: groupMatch },
      {
        $group: {
          _id: '$checkoutGroupId',
          placedAt: { $min: '$createdAt' },
        },
      },
      { $sort: { placedAt: -1 } },
      {
        $facet: {
          page: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const groupIds: string[] = (grouped[0]?.page || []).map((g: any) => g._id);
    const total: number = grouped[0]?.total?.[0]?.count || 0;

    const orders = groupIds.length
      ? await this.orderModel
          .find({ buyerId, checkoutGroupId: { $in: groupIds } })
          .sort({ createdAt: 1 })
          .lean()
      : [];

    const merchantNames = await this.marketplaceService.merchantNameMap(
      orders.map((o: any) => o.seller?.merchantId).filter(Boolean),
    );

    const groups = groupIds.map((gid) => {
      const groupOrders = orders.filter((o: any) => o.checkoutGroupId === gid);
      const first: any = groupOrders[0] || {};
      return {
        checkoutGroupId: gid,
        placedAt: first.createdAt,
        grandTotal: groupOrders.reduce(
          (sum: number, o: any) => sum + (o.pricing?.total || 0),
          0,
        ),
        deliveryAddress: first.deliveryAddress,
        walletPaymentRef: first.walletPaymentRef,
        orders: groupOrders.map((o: any) => {
          const mid = o.seller?.merchantId?.toString();
          return {
            id: o._id.toString(),
            orderNumber: o.orderNumber,
            seller:
              o.seller?.type === 'MERCHANT'
                ? {
                    type: 'MERCHANT',
                    merchantId: mid,
                    displayName: merchantNames.get(mid) || 'Merchant',
                  }
                : {
                    type: 'PLATFORM',
                    displayName: this.marketplaceService.platformStoreName,
                  },
            status: o.fulfillmentStatus,
            fulfillmentStatus: o.fulfillmentStatus,
            paymentStatus: o.paymentStatus,
            totalAmount: o.pricing?.total,
            itemCount: (o.items || []).length,
            buyerConfirmedAt: o.buyerConfirmedAt || null,
          };
        }),
      };
    });

    return { groups, total, page, limit };
  }

  /** GET /marketplace/orders/:id — ownership-scoped detail + siblings. */
  async myOrderDetail(
    userId: string,
    id: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_001');
    const order = await this.orderModel
      .findOne({ _id, buyerId: new Types.ObjectId(userId) })
      .lean();
    if (!order) {
      throw new MarketplaceException('ORD_001', HttpStatus.NOT_FOUND);
    }
    const seller = await this.sellerCard(order);
    const view = this.orderView(order, seller);

    const siblings = await this.orderModel
      .find({
        checkoutGroupId: (order as any).checkoutGroupId,
        _id: { $ne: _id },
      })
      .select('orderNumber seller fulfillmentStatus pricing.total items')
      .lean();
    const merchantNames = await this.marketplaceService.merchantNameMap(
      siblings.map((s: any) => s.seller?.merchantId).filter(Boolean),
    );
    view.siblingOrders = siblings.map((s: any) => ({
      id: s._id.toString(),
      orderNumber: s.orderNumber,
      status: s.fulfillmentStatus,
      totalAmount: s.pricing?.total,
      itemCount: (s.items || []).length,
      seller:
        s.seller?.type === 'MERCHANT'
          ? {
              type: 'MERCHANT',
              displayName:
                merchantNames.get(s.seller.merchantId?.toString()) ||
                'Merchant',
            }
          : {
              type: 'PLATFORM',
              displayName: this.marketplaceService.platformStoreName,
            },
    }));
    return view;
  }

  /** POST /marketplace/orders/:id/cancel — PENDING only, auto refund. */
  async cancelMyOrder(
    userId: string,
    id: string,
    dto: CancelOrderDto,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_001');
    const order = await this.orderModel.findOne({
      _id,
      buyerId: new Types.ObjectId(userId),
    });
    if (!order) {
      throw new MarketplaceException('ORD_001', HttpStatus.NOT_FOUND);
    }
    if (order.fulfillmentStatus !== 'PENDING') {
      throw new MarketplaceException('ORD_003', HttpStatus.CONFLICT, {
        current: order.fulfillmentStatus,
      });
    }

    // Claim the cancellation (guards a concurrent merchant advance).
    const claimed = await this.orderModel.findOneAndUpdate(
      { _id, fulfillmentStatus: 'PENDING' },
      {
        $set: {
          fulfillmentStatus: 'CANCELLED',
          cancelledBy: { type: 'buyer', id: userId },
          cancellationReason: dto.reason || null,
        },
        $push: {
          timeline: {
            status: 'CANCELLED',
            at: new Date(),
            actorType: 'buyer',
            actorId: userId,
            note: dto.reason || null,
          },
        },
      },
      { new: true },
    );
    if (!claimed) {
      throw new MarketplaceException('ORD_003', HttpStatus.CONFLICT);
    }

    // Mandatory wallet refund — idempotent by reference MKTREF<orderId>.
    const refundRef = `MKTREF${claimed._id.toString()}`;
    let walletView: Record<string, any> = {};
    try {
      const refund = await this.walletService.creditRefund(userId, {
        amount: claimed.pricing.total,
        reference: refundRef,
        category: 'REFUND',
        description: `Refund — cancelled order ${claimed.orderNumber}`,
        metadata: { orderId: claimed._id.toString() },
      });
      walletView = refund.wallet || {};
    } catch (error: any) {
      // Order state unchanged from the caller's perspective — revert & 502.
      this.logger.error(
        `Cancel refund failed for ${claimed.orderNumber}: ${error?.message}`,
      );
      await this.orderModel.updateOne(
        { _id },
        {
          $set: {
            fulfillmentStatus: 'PENDING',
            cancelledBy: null,
            cancellationReason: null,
          },
          $pull: { timeline: { status: 'CANCELLED' } },
        },
      );
      throw new MarketplaceException('ORD_005', HttpStatus.BAD_GATEWAY);
    }

    claimed.paymentStatus = 'REFUNDED';
    claimed.refundRef = refundRef;
    claimed.refundedTotal = claimed.pricing.total;
    await claimed.save();

    await this.restockOrderItems(claimed);

    // Notify the seller (merchant or admins) — §11.8 order.cancelled. Buyer
    // cancels also notify admins for MERCHANT orders (matrix note).
    await this.notifySeller(claimed, {
      event: MKT_EVENTS.ORDER_CANCELLED,
      type: 'warning',
      title: 'Order cancelled by buyer',
      body: `Order ${claimed.orderNumber} was cancelled — ₦${claimed.pricing.total.toLocaleString()} refunded to the buyer.`,
    });
    if (claimed.seller?.type === 'MERCHANT') {
      this.notificationService
        .notifyAdmins({
          event: MKT_EVENTS.ORDER_CANCELLED,
          type: 'warning',
          title: 'Order cancelled by buyer',
          body: `Order ${claimed.orderNumber} was cancelled by the buyer (auto refund).`,
          data: {
            orderId: claimed._id.toString(),
            link: `/bennie/orders/${claimed._id.toString()}`,
          },
        })
        .catch(() => undefined);
    }

    return {
      id: claimed._id.toString(),
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      refundRef,
      refunded: claimed.pricing.total,
      wallet: walletView,
    };
  }

  /** POST /marketplace/orders/:id/confirm-received — DELIVERED only, idempotent. */
  async confirmReceived(
    userId: string,
    id: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_001');
    const order = await this.orderModel.findOne({
      _id,
      buyerId: new Types.ObjectId(userId),
    });
    if (!order) {
      throw new MarketplaceException('ORD_001', HttpStatus.NOT_FOUND);
    }
    if (order.fulfillmentStatus !== 'DELIVERED') {
      throw new MarketplaceException('ORD_004', HttpStatus.CONFLICT, {
        current: order.fulfillmentStatus,
      });
    }
    if (order.buyerConfirmedAt) {
      // Idempotent repeat — same result, no second notification.
      return {
        id: order._id.toString(),
        status: order.fulfillmentStatus,
        buyerConfirmedAt: order.buyerConfirmedAt,
        confirmedReceivedAt: order.buyerConfirmedAt,
      };
    }

    order.buyerConfirmedAt = new Date();
    order.timeline.push({
      status: 'CONFIRMED_RECEIVED',
      at: order.buyerConfirmedAt,
      actorType: 'buyer',
      actorId: userId,
    } as any);
    await order.save();

    await this.notifySeller(order, {
      event: MKT_EVENTS.ORDER_RECEIPT_CONFIRMED,
      type: 'success',
      title: 'Buyer confirmed receipt',
      body: `The buyer confirmed receiving order ${order.orderNumber}.`,
    });

    return {
      id: order._id.toString(),
      status: order.fulfillmentStatus,
      buyerConfirmedAt: order.buyerConfirmedAt,
      confirmedReceivedAt: order.buyerConfirmedAt,
    };
  }
}
