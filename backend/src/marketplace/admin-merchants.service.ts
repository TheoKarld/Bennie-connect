import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import {
  MerchantEarning,
  MerchantEarningDocument,
} from './schemas/merchant-earning.schema';
import {
  MerchantPayoutRequest,
  MerchantPayoutRequestDocument,
} from './schemas/merchant-payout-request.schema';
import { UploadService } from '../storage/upload.service';
import { NotificationService } from '../notifications/notification.service';
import { MerchantService } from './merchant.service';
import { MarketplaceException, MKT_EVENTS } from './marketplace.constants';
import { toObjectId } from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import {
  CancelPayoutAdminDto,
  ListEarningsAdminDto,
  ListMerchantsAdminDto,
  ListPayoutsAdminDto,
  MarkPayoutSentDto,
  RejectMerchantDto,
  SuspendMerchantDto,
} from './dto/admin-merchants.dto';

/**
 * Admin merchants ops (PRD/admin_module/merchants/merchants.md): directory,
 * KYC review (approve/reject WITH doc purge from GCS + files), suspension
 * lifecycle (delists products), earnings ledger reads and the manual payout
 * queue (mark-sent = Super-Admin-only via `merchants:mark-payout-sent`).
 */
@Injectable()
export class AdminMerchantsService {
  private readonly logger = new Logger(AdminMerchantsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(MerchantEarning.name)
    private readonly earningModel: Model<MerchantEarningDocument>,
    @InjectModel(MerchantPayoutRequest.name)
    private readonly payoutModel: Model<MerchantPayoutRequestDocument>,
    private readonly uploadService: UploadService,
    private readonly notificationService: NotificationService,
    private readonly merchantService: MerchantService,
  ) {}

  private async notifyMerchantUser(
    merchant: MerchantDocument,
    input: {
      event: string;
      type?: any;
      title: string;
      body: string;
      link?: string;
    },
  ): Promise<void> {
    try {
      await this.notificationService.notify({
        recipientType: 'user',
        recipientId: merchant.userId,
        event: input.event,
        type: input.type || 'info',
        title: input.title,
        body: input.body,
        data: {
          merchantId: merchant._id.toString(),
          link: input.link || '/app/merchant',
        },
      });
    } catch (error: any) {
      this.logger.warn(`Merchant notification failed: ${error?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Directory & detail
  // ---------------------------------------------------------------------------

  async listMerchants(
    query: ListMerchantsAdminDto,
  ): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {};

    if (query.q) {
      const or: Record<string, any>[] = [
        { businessName: { $regex: query.q, $options: 'i' } },
        { merchantId: { $regex: query.q, $options: 'i' } },
      ];
      if (query.q.includes('@')) {
        const users = await this.connection
          .collection('users')
          .find(
            { email: { $regex: query.q, $options: 'i' } },
            { projection: { _id: 1 } },
          )
          .limit(50)
          .toArray();
        if (users.length) {
          or.push({ userId: { $in: users.map((u: any) => u._id) } });
        }
      }
      filter.$or = or;
    }
    if (query.kycStatus) filter.kycStatus = query.kycStatus;
    if (query.idType) filter.idType = query.idType;
    if (query.premblyVerified === 'true') {
      filter['premblyResult.status'] = 'VERIFIED';
    } else if (query.premblyVerified === 'false') {
      filter['premblyResult.status'] = { $in: ['NOT_VERIFIED', 'ERROR'] };
    } else if (query.premblyVerified === 'unchecked') {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { premblyResult: null },
            { 'premblyResult.checked': { $ne: true } },
          ],
        },
      ];
    }
    if (query.hasPendingPayout === 'true') {
      const pending = await this.payoutModel
        .find({ status: { $in: ['REQUESTED', 'MARKED_SENT'] } })
        .distinct('merchantId');
      filter._id = { $in: pending };
    } else if (query.hasPendingPayout === 'false') {
      const pending = await this.payoutModel
        .find({ status: { $in: ['REQUESTED', 'MARKED_SENT'] } })
        .distinct('merchantId');
      filter._id = { $nin: pending };
    }

    const sortField =
      query.sortBy === 'submittedAt'
        ? 'submittedAt'
        : query.sortBy === 'availableBalance'
          ? 'earnings.availableBalance'
          : 'createdAt';
    const sort: Record<string, 1 | -1> = {
      [sortField]: query.order === 'asc' ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.merchantModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.merchantModel.countDocuments(filter),
    ]);

    const users = await this.userInfoMap(docs.map((d: any) => d.userId));
    const listingCounts = await this.productModel.aggregate([
      {
        $match: {
          merchantId: { $in: docs.map((d: any) => d._id) },
          deletedAt: null,
        },
      },
      { $group: { _id: '$merchantId', count: { $sum: 1 } } },
    ]);
    const listingMap = new Map(
      listingCounts.map((c: any) => [c._id.toString(), c.count]),
    );

    return {
      items: docs.map((d: any) => {
        const user = users.get(d.userId?.toString());
        return {
          id: d._id.toString(),
          merchantId: d.merchantId,
          businessName: d.businessName,
          kycStatus: d.kycStatus,
          idType: d.idType || null,
          premblyStatus: d.premblyResult?.status || 'SKIPPED',
          owner: user || null,
          listings: listingMap.get(d._id.toString()) || 0,
          earnings: d.earnings,
          submittedAt: d.submittedAt || null,
          createdAt: d.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  private async userInfoMap(
    ids: (Types.ObjectId | string)[],
  ): Promise<Map<string, Record<string, any>>> {
    const unique = Array.from(new Set(ids.map((i) => i?.toString()))).filter(
      (i) => i && Types.ObjectId.isValid(i),
    ) as string[];
    if (!unique.length) {
      return new Map();
    }
    const rows = await this.connection
      .collection('users')
      .find(
        { _id: { $in: unique.map((i) => new Types.ObjectId(i)) } },
        {
          projection: {
            firstName: 1,
            lastName: 1,
            email: 1,
            phoneNumber: 1,
            userId: 1,
          },
        },
      )
      .toArray();
    return new Map(
      rows.map((u: any) => [
        u._id.toString(),
        {
          id: u._id.toString(),
          userId: u.userId,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          phoneNumber: u.phoneNumber,
        },
      ]),
    );
  }

  private async loadMerchant(id: string): Promise<MerchantDocument> {
    const _id = toObjectId(id, 'MERCH_ADM_001');
    const merchant = await this.merchantModel.findById(_id);
    if (!merchant) {
      throw new MarketplaceException('MERCH_ADM_001', HttpStatus.NOT_FOUND);
    }
    return merchant;
  }

  /** Full admin detail — business profile, ID data, Prembly panel, KYC docs. */
  async merchantDetail(id: string): Promise<Record<string, any>> {
    const merchant = await this.loadMerchant(id);
    const users = await this.userInfoMap([merchant.userId]);

    const [listings, openOrders, pendingPayouts] = await Promise.all([
      this.productModel.countDocuments({
        merchantId: merchant._id,
        deletedAt: null,
      }),
      this.orderModel.countDocuments({
        'seller.merchantId': merchant._id,
        fulfillmentStatus: { $in: ['PENDING', 'PROCESSING', 'SHIPPED'] },
      }),
      this.payoutModel.countDocuments({
        merchantId: merchant._id,
        status: { $in: ['REQUESTED', 'MARKED_SENT'] },
      }),
    ]);

    const plain = serialize<any>(merchant);
    return {
      ...plain,
      owner: users.get(merchant.userId.toString()) || null,
      // Admin reviewers see the full ID number (user plane always masks it).
      kycDocs: (plain.kycDocs || []).map((d: any) => ({
        label: d.label || null,
        fileId: d.id,
        originalName: d.originalName || null,
        fileType: d.fileType || null,
        size: d.size || null,
        visibility: d.visibility || 'private',
      })),
      counts: { listings, openOrders, pendingPayouts },
    };
  }

  // ---------------------------------------------------------------------------
  // KYC decision — approve / reject (+ purge)
  // ---------------------------------------------------------------------------

  /** Purge KYC docs from GCS + `files` (log-and-continue), empty kycDocs. */
  private async purgeKycDocs(merchant: MerchantDocument): Promise<string[]> {
    const purged: string[] = [];
    for (const doc of merchant.kycDocs || []) {
      const fileId = String((doc as any).id || '');
      if (!fileId) {
        continue;
      }
      const ok = await this.uploadService.removeQuietly(fileId);
      if (ok) {
        purged.push(fileId);
      } else {
        this.logger.warn(
          `KYC doc purge failed for file ${fileId} — continuing.`,
        );
      }
    }
    merchant.kycDocs = [];
    merchant.kycDocsPurgedAt = new Date();
    return purged;
  }

  async approveMerchant(
    id: string,
    adminId: string,
  ): Promise<{ view: Record<string, any>; purgedDocIds: string[] }> {
    const merchant = await this.loadMerchant(id);
    if (merchant.kycStatus !== 'PENDING_REVIEW') {
      throw new MarketplaceException('MERCH_ADM_002', HttpStatus.CONFLICT, {
        current: merchant.kycStatus,
      });
    }
    const purgedDocIds = await this.purgeKycDocs(merchant);
    merchant.kycStatus = 'APPROVED';
    merchant.reviewedBy = new Types.ObjectId(adminId);
    merchant.reviewedAt = new Date();
    merchant.rejectionReason = null;
    await merchant.save();

    await this.notifyMerchantUser(merchant, {
      event: MKT_EVENTS.MERCHANT_KYC_DECIDED,
      type: 'success',
      title: 'Merchant application approved',
      body: 'Congratulations — you can now sell on the cooperative marketplace.',
      link: '/app/merchant',
    });

    return {
      view: {
        id: merchant._id.toString(),
        kycStatus: merchant.kycStatus,
        reviewedAt: merchant.reviewedAt,
        kycDocsPurgedAt: merchant.kycDocsPurgedAt,
      },
      purgedDocIds,
    };
  }

  async rejectMerchant(
    id: string,
    dto: RejectMerchantDto,
    adminId: string,
  ): Promise<{ view: Record<string, any>; purgedDocIds: string[] }> {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new MarketplaceException(
        'MERCH_ADM_003',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const merchant = await this.loadMerchant(id);
    if (merchant.kycStatus !== 'PENDING_REVIEW') {
      throw new MarketplaceException('MERCH_ADM_002', HttpStatus.CONFLICT, {
        current: merchant.kycStatus,
      });
    }
    const purgedDocIds = await this.purgeKycDocs(merchant);
    merchant.kycStatus = 'REJECTED';
    merchant.reviewedBy = new Types.ObjectId(adminId);
    merchant.reviewedAt = new Date();
    merchant.rejectionReason = dto.reason.trim();
    await merchant.save();

    await this.notifyMerchantUser(merchant, {
      event: MKT_EVENTS.MERCHANT_KYC_DECIDED,
      type: 'warning',
      title: 'Merchant application rejected',
      body: `Your application was rejected: ${dto.reason.trim()} You may edit and resubmit (documents must be re-uploaded).`,
      link: '/app/merchant',
    });

    return {
      view: {
        id: merchant._id.toString(),
        kycStatus: merchant.kycStatus,
        reviewedAt: merchant.reviewedAt,
        kycDocsPurgedAt: merchant.kycDocsPurgedAt,
      },
      purgedDocIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Suspension lifecycle
  // ---------------------------------------------------------------------------

  async suspendMerchant(
    id: string,
    dto: SuspendMerchantDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const merchant = await this.loadMerchant(id);
    if (merchant.kycStatus !== 'APPROVED') {
      throw new MarketplaceException('MERCH_ADM_002', HttpStatus.CONFLICT, {
        current: merchant.kycStatus,
      });
    }
    merchant.kycStatus = 'SUSPENDED';
    merchant.suspendedBy = new Types.ObjectId(adminId);
    merchant.suspendedAt = new Date();
    merchant.suspensionReason = dto.reason.trim();
    await merchant.save();

    // Delist every product.
    const delisted = await this.productModel.updateMany(
      { merchantId: merchant._id },
      { $set: { suspended: true } },
    );

    await this.notifyMerchantUser(merchant, {
      event: MKT_EVENTS.MERCHANT_SUSPENDED,
      type: 'warning',
      title: 'Merchant account suspended',
      body: `Your merchant account was suspended: ${dto.reason.trim()} Existing orders can still be fulfilled.`,
      link: '/app/merchant',
    });

    return {
      id: merchant._id.toString(),
      kycStatus: merchant.kycStatus,
      suspendedAt: merchant.suspendedAt,
      productsDelisted: delisted.modifiedCount,
    };
  }

  async reinstateMerchant(id: string): Promise<Record<string, any>> {
    const merchant = await this.loadMerchant(id);
    if (merchant.kycStatus !== 'SUSPENDED') {
      throw new MarketplaceException('MERCH_ADM_002', HttpStatus.CONFLICT, {
        current: merchant.kycStatus,
      });
    }
    merchant.kycStatus = 'APPROVED';
    merchant.suspendedBy = null;
    merchant.suspendedAt = null;
    merchant.suspensionReason = null;
    await merchant.save();

    // Previously approved listings return to browse without re-moderation.
    const relisted = await this.productModel.updateMany(
      { merchantId: merchant._id },
      { $set: { suspended: false } },
    );

    await this.notifyMerchantUser(merchant, {
      event: MKT_EVENTS.MERCHANT_REINSTATED,
      type: 'success',
      title: 'Merchant account reinstated',
      body: 'Your merchant account has been reinstated — your listings are live again.',
      link: '/app/merchant',
    });

    return {
      id: merchant._id.toString(),
      kycStatus: merchant.kycStatus,
      productsRelisted: relisted.modifiedCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Earnings (read-only)
  // ---------------------------------------------------------------------------

  async merchantEarnings(
    id: string,
    query: ListEarningsAdminDto,
  ): Promise<Record<string, any>> {
    const merchant = await this.loadMerchant(id);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = { merchantId: merchant._id };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const [docs, total] = await Promise.all([
      this.earningModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.earningModel.countDocuments(filter),
    ]);
    return {
      summary: serialize(merchant.earnings),
      entries: serialize(docs),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // Payout queue
  // ---------------------------------------------------------------------------

  private async payoutView(request: any): Promise<Record<string, any>> {
    const plain = serialize<any>(request);
    const merchant = await this.merchantModel
      .findById(request.merchantId)
      .select('merchantId businessName kycStatus userId')
      .lean();
    return {
      ...plain,
      merchant: merchant
        ? {
            id: (merchant as any)._id.toString(),
            merchantId: (merchant as any).merchantId,
            businessName: (merchant as any).businessName,
            kycStatus: (merchant as any).kycStatus,
          }
        : null,
    };
  }

  /** Cross-merchant queue — default filter status=REQUESTED. */
  async listPayoutRequests(
    query: ListPayoutsAdminDto,
  ): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {};
    const status = query.status || 'REQUESTED';
    if (status !== 'ALL') {
      filter.status = status;
    }
    const [docs, total] = await Promise.all([
      this.payoutModel
        .find(filter)
        .sort({ requestedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.payoutModel.countDocuments(filter),
    ]);

    const merchantIds = docs.map((d: any) => d.merchantId);
    const merchants = merchantIds.length
      ? await this.merchantModel
          .find({ _id: { $in: merchantIds } })
          .select('merchantId businessName kycStatus')
          .lean()
      : [];
    const merchantMap = new Map(
      merchants.map((m: any) => [m._id.toString(), m]),
    );

    return {
      items: docs.map((d: any) => {
        const m = merchantMap.get(d.merchantId?.toString());
        return {
          ...serialize<any>(d),
          merchant: m
            ? {
                id: m._id.toString(),
                merchantId: m.merchantId,
                businessName: m.businessName,
                kycStatus: m.kycStatus,
              }
            : null,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async merchantPayoutRequests(id: string): Promise<Record<string, any>> {
    const merchant = await this.loadMerchant(id);
    const docs = await this.payoutModel
      .find({ merchantId: merchant._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return { items: serialize(docs) };
  }

  async payoutRequestDetail(reqId: string): Promise<Record<string, any>> {
    const _id = toObjectId(reqId, 'MERCH_ADM_010');
    const request = await this.payoutModel.findById(_id).lean();
    if (!request) {
      throw new MarketplaceException('MERCH_ADM_010', HttpStatus.NOT_FOUND);
    }
    const view = await this.payoutView(request);
    if ((request as any).entryIds?.length) {
      view.entries = serialize(
        await this.earningModel
          .find({ _id: { $in: (request as any).entryIds } })
          .lean(),
      );
    }
    return view;
  }

  /** Mark funds wired (REQUESTED → MARKED_SENT). Super-Admin-only permission. */
  async markPayoutSent(
    reqId: string,
    dto: MarkPayoutSentDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    if (!dto.paymentReference || !dto.paymentReference.trim()) {
      throw new MarketplaceException(
        'MERCH_ADM_009',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const _id = toObjectId(reqId, 'MERCH_ADM_010');
    const request = await this.payoutModel.findById(_id);
    if (!request) {
      throw new MarketplaceException('MERCH_ADM_010', HttpStatus.NOT_FOUND);
    }
    if (request.status !== 'REQUESTED') {
      throw new MarketplaceException('MERCH_ADM_008', HttpStatus.CONFLICT, {
        current: request.status,
      });
    }
    const merchant = await this.merchantModel.findById(request.merchantId);
    if (!merchant) {
      throw new MarketplaceException('MERCH_ADM_001', HttpStatus.NOT_FOUND);
    }
    if (merchant.kycStatus === 'SUSPENDED') {
      throw new MarketplaceException('MERCH_ADM_007', HttpStatus.CONFLICT);
    }

    request.status = 'MARKED_SENT';
    request.markedSentBy = new Types.ObjectId(adminId);
    request.markedSentAt = new Date();
    request.paymentReference = dto.paymentReference.trim();
    await request.save();

    await this.notifyMerchantUser(merchant, {
      event: MKT_EVENTS.PAYOUT_MARKED_SENT,
      type: 'success',
      title: 'Payout sent',
      body: `₦${request.amount.toLocaleString()} was wired to your ${request.bankAccount.bankName} account (ref ${request.paymentReference}). Please confirm receipt in the Merchant Hub.`,
      link: '/app/merchant?tab=earnings',
    });

    return {
      id: request._id.toString(),
      requestId: request.requestId,
      status: request.status,
      amount: request.amount,
      paymentReference: request.paymentReference,
      markedSentAt: request.markedSentAt,
      awaitingMerchantConfirmation: true,
    };
  }

  /** Cancel/void a payout request (REQUESTED or MARKED_SENT) — unlocks entries. */
  async cancelPayoutRequest(
    reqId: string,
    dto: CancelPayoutAdminDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(reqId, 'MERCH_ADM_010');
    const request = await this.payoutModel.findById(_id);
    if (!request) {
      throw new MarketplaceException('MERCH_ADM_010', HttpStatus.NOT_FOUND);
    }
    if (!['REQUESTED', 'MARKED_SENT'].includes(request.status)) {
      throw new MarketplaceException('MERCH_ADM_008', HttpStatus.CONFLICT, {
        current: request.status,
      });
    }

    request.status = 'CANCELLED';
    request.cancelledBy = adminId;
    request.cancelReason = dto.reason.trim();
    await request.save();

    await this.merchantService.releasePayoutHold(request);

    const merchant = await this.merchantModel.findById(request.merchantId);
    if (merchant) {
      await this.notifyMerchantUser(merchant, {
        event: MKT_EVENTS.PAYOUT_CANCELLED,
        type: 'info',
        title: 'Payout request cancelled',
        body: `Your payout request ${request.requestId} was cancelled by an administrator: ${dto.reason.trim()} The amount is available again.`,
        link: '/app/merchant?tab=earnings',
      });
    }

    return {
      id: request._id.toString(),
      requestId: request.requestId,
      status: request.status,
      cancelReason: request.cancelReason,
    };
  }
}
