import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import {
  MerchantEarning,
  MerchantEarningDocument,
} from './schemas/merchant-earning.schema';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notifications/notification.service';
import { OrdersService } from './orders.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceException, MKT_EVENTS } from './marketplace.constants';
import { computePlatformFee, toObjectId } from './marketplace.helpers';
import {
  AdminCancelOrderDto,
  AdminFulfillmentDto,
  AdminRefundDto,
  ListOrdersAdminDto,
} from './dto/admin-orders.dto';

/**
 * Admin orders ops (PRD/admin_module/admin_orders/orders.md): omniscient
 * list/detail, fulfilment overrides (backward = corrective, note required,
 * earnings-locked guard), cancel-with-mandatory-refund, and Super-Admin-only
 * discretionary refunds (partial → PARTIALLY_REFUNDED, earnings clawback).
 */
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(MerchantEarning.name)
    private readonly earningModel: Model<MerchantEarningDocument>,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly ordersService: OrdersService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async listOrders(query: ListOrdersAdminDto): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {};

    if (query.orderNumber) {
      filter.orderNumber = { $regex: query.orderNumber, $options: 'i' };
    }
    if (query.checkoutGroupId) {
      filter.checkoutGroupId = query.checkoutGroupId;
    }
    if (query.buyerId) filter.buyerId = new Types.ObjectId(query.buyerId);
    if (query.sellerType) filter['seller.type'] = query.sellerType;
    if (query.merchantId) {
      filter['seller.merchantId'] = new Types.ObjectId(query.merchantId);
    }
    if (query.productId) {
      filter['items.productId'] = new Types.ObjectId(query.productId);
    }
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.fulfillmentStatus) {
      filter.fulfillmentStatus = query.fulfillmentStatus;
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }
    if (query.minTotal !== undefined || query.maxTotal !== undefined) {
      filter['pricing.total'] = {};
      if (query.minTotal !== undefined) {
        filter['pricing.total'].$gte = query.minTotal;
      }
      if (query.maxTotal !== undefined) {
        filter['pricing.total'].$lte = query.maxTotal;
      }
    }
    if (query.buyerConfirmed !== undefined) {
      filter.buyerConfirmedAt = query.buyerConfirmed ? { $ne: null } : null;
    }

    const sortField = query.sortBy === 'total' ? 'pricing.total' : 'createdAt';
    const sort: Record<string, 1 | -1> = {
      [sortField]: query.order === 'asc' ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);

    const [buyers, merchantNames] = await Promise.all([
      this.ordersService.userMap(docs.map((d: any) => d.buyerId)),
      this.marketplaceService.merchantNameMap(
        docs.map((d: any) => d.seller?.merchantId).filter(Boolean),
      ),
    ]);

    return {
      items: docs.map((d: any) => {
        const buyer = buyers.get(d.buyerId?.toString());
        const mid = d.seller?.merchantId?.toString();
        return {
          id: d._id.toString(),
          orderNumber: d.orderNumber,
          checkoutGroupId: d.checkoutGroupId,
          buyer: {
            id: d.buyerId?.toString(),
            name: buyer?.name || 'Member',
          },
          seller:
            d.seller?.type === 'MERCHANT'
              ? {
                  type: 'MERCHANT',
                  merchantId: mid,
                  businessName: merchantNames.get(mid) || 'Merchant',
                }
              : {
                  type: 'PLATFORM',
                  businessName: this.marketplaceService.platformStoreName,
                },
          itemCount: (d.items || []).length,
          total: d.pricing?.total,
          paymentStatus: d.paymentStatus,
          fulfillmentStatus: d.fulfillmentStatus,
          refundedTotal: d.refundedTotal || 0,
          buyerConfirmedAt: d.buyerConfirmedAt || null,
          createdAt: d.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async orderDetail(id: string): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_ADM_001');
    const order = await this.orderModel.findById(_id).lean();
    if (!order) {
      throw new MarketplaceException('ORD_ADM_001', HttpStatus.NOT_FOUND);
    }

    const [buyers, seller, siblings] = await Promise.all([
      this.ordersService.userMap([(order as any).buyerId]),
      this.ordersService.sellerCard(order),
      this.orderModel
        .find({
          checkoutGroupId: (order as any).checkoutGroupId,
          _id: { $ne: _id },
        })
        .select('orderNumber seller fulfillmentStatus pricing.total')
        .lean(),
    ]);

    const buyer = buyers.get((order as any).buyerId?.toString());
    const view = this.ordersService.orderView(order, {
      ...seller,
      businessName: seller.displayName,
    });
    view.buyer = {
      id: (order as any).buyerId?.toString(),
      name: buyer?.name || 'Member',
      phone: buyer?.phone || null,
      userId: buyer?.userId || null,
    };
    view.remainingRefundable =
      ((order as any).pricing?.total || 0) -
      ((order as any).refundedTotal || 0);
    view.siblingOrders = siblings.map((s: any) => ({
      id: s._id.toString(),
      orderNumber: s.orderNumber,
      sellerType: s.seller?.type,
      fulfillmentStatus: s.fulfillmentStatus,
      total: s.pricing?.total,
    }));
    return view;
  }

  async checkoutGroup(checkoutGroupId: string): Promise<Record<string, any>> {
    const orders = await this.orderModel
      .find({ checkoutGroupId })
      .sort({ createdAt: 1 })
      .lean();
    if (!orders.length) {
      throw new MarketplaceException('ORD_ADM_010', HttpStatus.NOT_FOUND);
    }
    const merchantNames = await this.marketplaceService.merchantNameMap(
      orders.map((o: any) => o.seller?.merchantId).filter(Boolean),
    );
    return {
      checkoutGroupId,
      grandTotal: orders.reduce(
        (sum: number, o: any) => sum + (o.pricing?.total || 0),
        0,
      ),
      orders: orders.map((o: any) => {
        const mid = o.seller?.merchantId?.toString();
        return {
          ...this.ordersService.orderView(o),
          seller:
            o.seller?.type === 'MERCHANT'
              ? {
                  type: 'MERCHANT',
                  merchantId: mid,
                  businessName: merchantNames.get(mid) || 'Merchant',
                }
              : {
                  type: 'PLATFORM',
                  businessName: this.marketplaceService.platformStoreName,
                },
        };
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Fulfilment override (orders:update)
  // ---------------------------------------------------------------------------

  /**
   * Admin may set any non-CANCELLED status. Backward moves are corrective:
   * `note` required, high-severity audit (controller), and a corrective move
   * out of DELIVERED reverses the earnings booking — blocked when the entry
   * is LOCKED/SETTLED in a payout (ORD_ADM_008).
   */
  async overrideFulfillment(
    id: string,
    dto: AdminFulfillmentDto,
    adminId: string,
  ): Promise<{
    view: Record<string, any>;
    corrective: boolean;
    before: string;
  }> {
    const _id = toObjectId(id, 'ORD_ADM_001');
    const order = await this.orderModel.findById(_id);
    if (!order) {
      throw new MarketplaceException('ORD_ADM_001', HttpStatus.NOT_FOUND);
    }
    const from = order.fulfillmentStatus;
    const to = dto.fulfillmentStatus;

    if (from === 'CANCELLED') {
      throw new MarketplaceException('ORD_ADM_002', HttpStatus.CONFLICT, {
        from,
        to,
      });
    }
    if (from === to) {
      throw new MarketplaceException('ORD_ADM_002', HttpStatus.CONFLICT, {
        from,
        to,
      });
    }

    const fromIdx = this.ordersService.flowIndex(from);
    const toIdx = this.ordersService.flowIndex(to);
    const corrective = toIdx < fromIdx;

    if (corrective && (!dto.note || dto.note.trim().length < 5)) {
      throw new MarketplaceException(
        'ORD_ADM_005',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Corrective move out of DELIVERED — earnings interaction.
    if (from === 'DELIVERED' && corrective && order.earningsBooked) {
      const entry = await this.earningModel.findOne({
        orderId: order._id,
        type: 'ORDER_EARNING',
      });
      if (entry) {
        if (['LOCKED', 'SETTLED'].includes(entry.status)) {
          throw new MarketplaceException('ORD_ADM_008', HttpStatus.CONFLICT, {
            entryStatus: entry.status,
          });
        }
        if (entry.status === 'AVAILABLE') {
          entry.status = 'REVERSED';
          entry.note = `Reversed — corrective un-deliver by admin (${dto.note?.trim()})`;
          await entry.save();
          await this.merchantModel.updateOne(
            { _id: entry.merchantId },
            {
              $inc: {
                'earnings.availableBalance': -entry.net,
                'earnings.lifetimeEarned': -entry.net,
              },
            },
          );
        }
      }
      order.earningsBooked = false;
      order.deliveredAt = null;
    }

    order.fulfillmentStatus = to as any;
    if (to === 'DELIVERED') {
      order.deliveredAt = new Date();
    }
    if (dto.trackingInfo) {
      order.trackingInfo = {
        carrier: dto.trackingInfo.carrier,
        trackingNumber: dto.trackingInfo.trackingNumber,
      };
    }
    order.timeline.push({
      status: to,
      at: new Date(),
      actorType: 'admin',
      actorId: adminId,
      note: dto.note?.trim() || null,
    } as any);
    await order.save();

    if (to === 'DELIVERED') {
      await this.ordersService.bookEarningsIfNeeded(order);
    }

    // Notify the buyer (+ merchant on MERCHANT orders).
    await this.ordersService.notifyBuyerStatus(order);
    if (order.seller?.type === 'MERCHANT') {
      await this.ordersService.notifySeller(order, {
        event: MKT_EVENTS.ORDER_STATUS,
        type: 'info',
        title: 'Order status updated by admin',
        body: `Order ${order.orderNumber} was moved to ${to} by an administrator.`,
      });
    }

    return {
      view: this.ordersService.orderView(order),
      corrective,
      before: from,
    };
  }

  // ---------------------------------------------------------------------------
  // Cancel (orders:update) — mandatory full refund, system-mediated
  // ---------------------------------------------------------------------------

  async cancelOrder(
    id: string,
    dto: AdminCancelOrderDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_ADM_001');
    const order = await this.orderModel.findById(_id);
    if (!order) {
      throw new MarketplaceException('ORD_ADM_001', HttpStatus.NOT_FOUND);
    }
    if (
      !['PENDING', 'PROCESSING', 'SHIPPED'].includes(order.fulfillmentStatus)
    ) {
      throw new MarketplaceException('ORD_ADM_007', HttpStatus.CONFLICT, {
        current: order.fulfillmentStatus,
      });
    }

    const claimed = await this.orderModel.findOneAndUpdate(
      { _id, fulfillmentStatus: order.fulfillmentStatus },
      {
        $set: {
          fulfillmentStatus: 'CANCELLED',
          cancelledBy: { type: 'admin', id: adminId },
          cancellationReason: dto.reason.trim(),
        },
        $push: {
          timeline: {
            status: 'CANCELLED',
            at: new Date(),
            actorType: 'admin',
            actorId: adminId,
            note: dto.reason.trim(),
          },
        },
      },
      { new: true },
    );
    if (!claimed) {
      throw new MarketplaceException('ORD_ADM_007', HttpStatus.CONFLICT);
    }

    // Mandatory full refund of the remaining amount — same idempotent path
    // the buyer's own PENDING-cancel uses (MKTREF<orderId>).
    const refundAmount = claimed.pricing.total - (claimed.refundedTotal || 0);
    const refundRef = `MKTREF${claimed._id.toString()}`;
    try {
      await this.walletService.creditRefund(claimed.buyerId, {
        amount: refundAmount,
        reference: refundRef,
        category: 'REFUND',
        description: `Refund — order ${claimed.orderNumber} cancelled by admin`,
        metadata: { orderId: claimed._id.toString() },
      });
    } catch (error: any) {
      this.logger.error(
        `Admin-cancel refund failed for ${claimed.orderNumber}: ${error?.message}`,
      );
      await this.orderModel.updateOne(
        { _id },
        {
          $set: {
            fulfillmentStatus: order.fulfillmentStatus,
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

    if (dto.restock !== false) {
      await this.ordersService.restockOrderItems(claimed);
    }

    // Notify the buyer (+ merchant on MERCHANT orders).
    try {
      await this.notificationService.notify({
        recipientType: 'user',
        recipientId: claimed.buyerId,
        event: MKT_EVENTS.ORDER_CANCELLED,
        type: 'warning',
        title: 'Order cancelled',
        body: `Order ${claimed.orderNumber} was cancelled — ₦${refundAmount.toLocaleString()} refunded to your wallet.`,
        data: {
          orderId: claimed._id.toString(),
          link: `/app/marketplace/orders/${claimed._id.toString()}`,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Cancel notification failed: ${error?.message}`);
    }
    if (claimed.seller?.type === 'MERCHANT') {
      await this.ordersService.notifySeller(claimed, {
        event: MKT_EVENTS.ORDER_CANCELLED,
        type: 'warning',
        title: 'Order cancelled by admin',
        body: `Order ${claimed.orderNumber} was cancelled by an administrator: ${dto.reason.trim()}`,
      });
    }

    return {
      id: claimed._id.toString(),
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      refund: { amount: refundAmount, reference: refundRef },
    };
  }

  // ---------------------------------------------------------------------------
  // Discretionary refund (orders:refund — Super-Admin-only)
  // ---------------------------------------------------------------------------

  async refundOrder(
    id: string,
    dto: AdminRefundDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'ORD_ADM_001');
    const order = await this.orderModel.findById(_id);
    if (!order) {
      throw new MarketplaceException('ORD_ADM_001', HttpStatus.NOT_FOUND);
    }
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new MarketplaceException('ORD_ADM_003', HttpStatus.CONFLICT, {
        paymentStatus: order.paymentStatus,
      });
    }

    // Refund window (settings-seeded; Super Admin may override — audited).
    const windowDays = this.marketplaceService.cfg('refundWindowDays', 14);
    const createdAt = (order as any).createdAt as Date;
    const ageDays = (Date.now() - createdAt.getTime()) / 86400000;
    if (ageDays > windowDays && !dto.overrideWindow) {
      throw new MarketplaceException('ORD_ADM_003', HttpStatus.CONFLICT, {
        windowDays,
        orderAgeDays: Math.floor(ageDays),
        hint: 'Set overrideWindow: true to refund outside the window (audited).',
      });
    }

    const remaining = order.pricing.total - (order.refundedTotal || 0);
    const amount = dto.amount ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new MarketplaceException('ORD_ADM_004', HttpStatus.CONFLICT, {
        requested: amount,
        remaining,
      });
    }

    const seq = (order.refunds || []).length + 1;
    const reference = `refund:${order._id.toString()}:${seq}`;
    try {
      const result = await this.walletService.creditRefund(order.buyerId, {
        amount,
        reference,
        category: 'REFUND',
        description: `Refund — order ${order.orderNumber}: ${dto.reason.trim()}`,
        metadata: { orderId: order._id.toString(), seq },
      });
      if (result.alreadyProcessed && result.amount !== amount) {
        throw new MarketplaceException('ORD_ADM_006', HttpStatus.CONFLICT, {
          reference,
          previousAmount: result.amount,
        });
      }
    } catch (error: any) {
      if (error instanceof MarketplaceException) {
        throw error;
      }
      this.logger.error(
        `Refund failed for ${order.orderNumber}: ${error?.message}`,
      );
      throw new MarketplaceException('ORD_005', HttpStatus.BAD_GATEWAY);
    }

    order.refunds.push({
      amount,
      reason: dto.reason.trim(),
      reference,
      restock: Boolean(dto.restock),
      refundedBy: new Types.ObjectId(adminId),
      at: new Date(),
    } as any);
    order.refundedTotal = (order.refundedTotal || 0) + amount;
    const fullyRefunded = order.refundedTotal >= order.pricing.total;
    order.paymentStatus = fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    order.timeline.push({
      status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      at: new Date(),
      actorType: 'admin',
      actorId: adminId,
      note: dto.reason.trim(),
    } as any);
    await order.save();

    // Restock — full refunds only (a partial NGN amount has no per-item
    // quantity mapping; deviation documented).
    if (dto.restock && fullyRefunded) {
      await this.ordersService.restockOrderItems(order);
    }

    // Merchant-earnings interaction (orders.md §4.4).
    let earningsAdjusted = false;
    if (
      order.seller?.type === 'MERCHANT' &&
      order.seller.merchantId &&
      order.earningsBooked
    ) {
      earningsAdjusted = true;
      const entry = await this.earningModel.findOne({
        orderId: order._id,
        type: 'ORDER_EARNING',
      });
      const feePercent = order.pricing.platformFeePercent || 0;
      if (entry && entry.status === 'AVAILABLE' && fullyRefunded) {
        entry.status = 'REVERSED';
        entry.note = 'Reversed — order fully refunded';
        await entry.save();
        await this.merchantModel.updateOne(
          { _id: entry.merchantId },
          {
            $inc: {
              'earnings.availableBalance': -entry.net,
              'earnings.lifetimeEarned': -entry.net,
            },
          },
        );
      } else {
        // Partial refund, or LOCKED/SETTLED entry → negative ADJUSTMENT
        // netted against future availability.
        const clawback = amount - computePlatformFee(amount, feePercent);
        await this.earningModel.create({
          merchantId: order.seller.merchantId,
          type: 'ADJUSTMENT',
          orderId: null,
          orderNumber: order.orderNumber,
          gross: -amount,
          platformFeePercent: feePercent,
          platformFee: -computePlatformFee(amount, feePercent),
          net: -clawback,
          status: 'AVAILABLE',
          note: `Clawback — refund on order ${order.orderNumber}`,
          bookedAt: new Date(),
        });
        await this.merchantModel.updateOne(
          { _id: order.seller.merchantId },
          {
            $inc: {
              'earnings.availableBalance': -clawback,
              'earnings.lifetimeEarned': -clawback,
            },
          },
        );
      }
    }

    // Notify the buyer (+ merchant when earnings were adjusted).
    try {
      await this.notificationService.notify({
        recipientType: 'user',
        recipientId: order.buyerId,
        event: MKT_EVENTS.ORDER_REFUNDED,
        type: 'success',
        title: fullyRefunded ? 'Order refunded' : 'Partial refund credited',
        body: `₦${amount.toLocaleString()} was refunded to your wallet for order ${order.orderNumber}.`,
        data: {
          orderId: order._id.toString(),
          amount,
          link: `/app/marketplace/orders/${order._id.toString()}`,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Refund notification failed: ${error?.message}`);
    }
    if (earningsAdjusted) {
      await this.ordersService.notifySeller(order, {
        event: MKT_EVENTS.ORDER_REFUNDED,
        type: 'warning',
        title: 'Order refunded — earnings adjusted',
        body: `Order ${order.orderNumber} was refunded ₦${amount.toLocaleString()}; your earnings were adjusted accordingly.`,
      });
    }

    return {
      id: order._id.toString(),
      paymentStatus: order.paymentStatus,
      refundedTotal: order.refundedTotal,
      refund: { amount, reference, seq },
      earningsAdjusted,
    };
  }
}
