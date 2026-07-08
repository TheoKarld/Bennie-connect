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
import { PremblyService } from './prembly.service';
import { OrdersService } from './orders.service';
import { MarketplaceService } from './marketplace.service';
import {
  ID_NUMBER_PATTERNS,
  MarketplaceException,
  MerchantIdType,
  MERCHANT_ID_TYPES,
  MKT_EVENTS,
} from './marketplace.constants';
import {
  genBizId,
  maskIdNumber,
  removedMediaIds,
  slugify,
  toObjectId,
  validateAndNormalizeMedia,
} from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import {
  CreatePayoutRequestDto,
  ListEarningsDto,
  ListMerchantOrdersDto,
  ListMerchantProductsDto,
  MerchantFulfillmentDto,
  MerchantKycDto,
  MerchantProductCreateDto,
  MerchantProductUpdateDto,
} from './dto/merchant.dto';

/**
 * Merchant Hub (merchant_panel.md): status-driven KYC onboarding (Prembly
 * advisory + private-bucket docs), listings with per-listing moderation,
 * own-order fulfilment (earnings booked at DELIVERED), earnings ledger and
 * the manual adashe-style payout lifecycle.
 */
@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

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
    private readonly premblyService: PremblyService,
    private readonly ordersService: OrdersService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  private async findByUser(userId: string): Promise<MerchantDocument | null> {
    return this.merchantModel.findOne({
      userId: new Types.ObjectId(userId),
    });
  }

  private requireMerchant(merchant: MerchantDocument | null): MerchantDocument {
    if (!merchant) {
      throw new MarketplaceException('MERCH_001', HttpStatus.NOT_FOUND);
    }
    return merchant;
  }

  /** Selling actions require APPROVED (SUSPENDED → MERCH_016). */
  private requireApproved(merchant: MerchantDocument | null): MerchantDocument {
    const m = this.requireMerchant(merchant);
    if (m.kycStatus === 'SUSPENDED') {
      throw new MarketplaceException('MERCH_016', HttpStatus.FORBIDDEN);
    }
    if (m.kycStatus !== 'APPROVED') {
      throw new MarketplaceException('MERCH_002', HttpStatus.FORBIDDEN);
    }
    return m;
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone) {
      return undefined;
    }
    return phone.startsWith('0') ? `+234${phone.slice(1)}` : phone;
  }

  private normalizeIdType(idType?: string): MerchantIdType | undefined {
    if (!idType) {
      return undefined;
    }
    const normalized =
      idType === 'DRIVERS_LICENSE' ? 'DRIVERS_LICENCE' : idType;
    if (!MERCHANT_ID_TYPES.includes(normalized as MerchantIdType)) {
      throw new MarketplaceException(
        'MERCH_004',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return normalized as MerchantIdType;
  }

  // ---------------------------------------------------------------------------
  // Me
  // ---------------------------------------------------------------------------

  /** GET /merchant/me — never 404s; NOT_STARTED when no doc exists. */
  async me(userId: string): Promise<Record<string, any>> {
    const merchant = await this.findByUser(userId);
    if (!merchant) {
      return { status: 'NOT_STARTED' };
    }

    const [products, pendingModeration, openOrders] = await Promise.all([
      this.productModel.countDocuments({
        merchantId: merchant._id,
        deletedAt: null,
      }),
      this.productModel.countDocuments({
        merchantId: merchant._id,
        deletedAt: null,
        moderationStatus: 'PENDING',
      }),
      this.orderModel.countDocuments({
        'seller.merchantId': merchant._id,
        fulfillmentStatus: { $in: ['PENDING', 'PROCESSING', 'SHIPPED'] },
      }),
    ]);

    return this.meView(merchant, { products, pendingModeration, openOrders });
  }

  private meView(
    merchant: MerchantDocument,
    counts?: Record<string, number>,
  ): Record<string, any> {
    const plain = serialize<any>(merchant);
    const prembly = plain.premblyResult || null;
    return {
      status: plain.kycStatus,
      merchantId: plain.id,
      merchantRef: plain.merchantId,
      businessInfo: {
        businessName: plain.businessName || null,
        businessAddress: plain.businessAddress?.street || null,
        state: plain.businessAddress?.state || null,
        lga: plain.businessAddress?.lga || null,
        phoneNumber: plain.businessPhone || null,
        description: plain.businessDescription || null,
        email: plain.businessEmail || null,
        cacNumber: plain.cacRcNumber || null,
      },
      kyc: {
        idType: plain.idType || null,
        idNumberMasked: maskIdNumber(plain.idNumber),
        prembly: prembly
          ? {
              status: prembly.status || (prembly.checked ? 'ERROR' : 'SKIPPED'),
              matchedName: prembly.matchedName || null,
              checkedAt: prembly.checkedAt || null,
            }
          : null,
        documents: (plain.kycDocs || []).map((d: any) => ({
          label: d.label || null,
          fileId: d.id,
          originalName: d.originalName || null,
          fileType: d.fileType || null,
        })),
        docsPurgedAt: plain.kycDocsPurgedAt || null,
      },
      rejectionReason: plain.rejectionReason || null,
      suspensionReason: plain.suspensionReason || null,
      resubmissionCount: plain.resubmissionCount || 0,
      earnings: {
        totalEarned: plain.earnings?.lifetimeEarned || 0,
        totalPaidOut: plain.earnings?.lifetimePaidOut || 0,
        pendingPayout: plain.earnings?.pendingPayout || 0,
        available: plain.earnings?.availableBalance || 0,
      },
      ...(counts ? { counts } : {}),
      submittedAt: plain.submittedAt || null,
      reviewedAt: plain.reviewedAt || null,
    };
  }

  // ---------------------------------------------------------------------------
  // KYC save / submit / resubmit
  // ---------------------------------------------------------------------------

  async saveKyc(
    userId: string,
    dto: MerchantKycDto,
  ): Promise<Record<string, any>> {
    let merchant = await this.findByUser(userId);

    if (merchant && !['IN_PROGRESS', 'REJECTED'].includes(merchant.kycStatus)) {
      throw new MarketplaceException('MERCH_003', HttpStatus.CONFLICT, {
        current: merchant.kycStatus,
      });
    }

    const wasRejected = merchant?.kycStatus === 'REJECTED';

    if (!merchant) {
      merchant = new this.merchantModel({
        merchantId: genBizId('MCH'),
        userId: new Types.ObjectId(userId),
        kycStatus: 'IN_PROGRESS',
      });
    } else if (wasRejected) {
      merchant.kycStatus = 'IN_PROGRESS';
    }

    // Business info (partial bodies allowed on draft saves).
    const info = dto.businessInfo;
    if (info) {
      if (info.businessName !== undefined) {
        merchant.businessName = info.businessName;
      }
      if (info.businessAddress !== undefined) {
        merchant.businessAddress = {
          ...(merchant.businessAddress || {}),
          street: info.businessAddress,
        } as any;
      }
      if (info.state !== undefined) {
        merchant.businessAddress = {
          ...(merchant.businessAddress || {}),
          state: info.state,
        } as any;
      }
      if (info.lga !== undefined) {
        merchant.businessAddress = {
          ...(merchant.businessAddress || {}),
          lga: info.lga,
          city: info.lga,
        } as any;
      }
      if (info.phoneNumber !== undefined) {
        merchant.businessPhone = this.normalizePhone(info.phoneNumber) || '';
      }
      if (info.description !== undefined) {
        merchant.businessDescription = info.description;
      }
      if (info.email !== undefined) {
        merchant.businessEmail = info.email;
      }
      if (info.cacNumber !== undefined) {
        merchant.cacRcNumber = info.cacNumber?.toUpperCase();
        merchant.isRegisteredBusiness = Boolean(info.cacNumber);
      }
    }

    // KYC block.
    if (dto.kyc) {
      const idType = this.normalizeIdType(dto.kyc.idType);
      if (idType) {
        merchant.idType = idType;
      }
      if (dto.kyc.idNumber !== undefined) {
        merchant.idNumber = dto.kyc.idNumber.trim();
      }
      if (dto.kyc.documents) {
        if (dto.kyc.documents.length < 1 || dto.kyc.documents.length > 3) {
          throw new MarketplaceException(
            'MERCH_005',
            HttpStatus.UNPROCESSABLE_ENTITY,
            { documents: dto.kyc.documents.length },
          );
        }
        const docs: Record<string, any>[] = [];
        for (const entry of dto.kyc.documents) {
          const meta = await this.uploadService.findMetadata(entry.fileId);
          const isImageOrPdf =
            meta &&
            (String(meta.fileType).startsWith('image/') ||
              meta.fileType === 'application/pdf');
          if (
            !meta ||
            meta.visibility !== 'private' ||
            meta.uploaderType !== 'user' ||
            meta.uploaderId !== userId.toString() ||
            !isImageOrPdf
          ) {
            throw new MarketplaceException(
              'MERCH_005',
              HttpStatus.UNPROCESSABLE_ENTITY,
              { fileId: entry.fileId },
            );
          }
          docs.push({ label: entry.label, ...meta });
        }
        merchant.kycDocs = docs;
        merchant.kycDocsPurgedAt = null;
      }
    }

    // Submit — completeness + advisory Prembly + PENDING_REVIEW.
    if (dto.submit) {
      const missing: string[] = [];
      if (!merchant.businessName) missing.push('businessInfo.businessName');
      if (!merchant.businessAddress?.street)
        missing.push('businessInfo.businessAddress');
      if (!merchant.businessAddress?.state) missing.push('businessInfo.state');
      if (!merchant.businessPhone) missing.push('businessInfo.phoneNumber');
      if (!merchant.idType) missing.push('kyc.idType');
      if (!merchant.idNumber) missing.push('kyc.idNumber');
      if (!merchant.kycDocs?.length) missing.push('kyc.documents');
      if (missing.length) {
        throw new MarketplaceException(
          'MERCH_005',
          HttpStatus.UNPROCESSABLE_ENTITY,
          { missing },
        );
      }

      const pattern = ID_NUMBER_PATTERNS[merchant.idType as MerchantIdType];
      if (pattern && !pattern.test(merchant.idNumber!)) {
        throw new MarketplaceException(
          'MERCH_006',
          HttpStatus.UNPROCESSABLE_ENTITY,
          { idType: merchant.idType },
        );
      }

      // Advisory Prembly check — NEVER throws into the submit path.
      const user: any = await this.connection
        .collection('users')
        .findOne(
          { _id: new Types.ObjectId(userId) },
          { projection: { firstName: 1, lastName: 1 } },
        );
      merchant.premblyResult = await this.premblyService.verifyIdentity({
        idType: merchant.idType as MerchantIdType,
        idNumber: merchant.idNumber!,
        firstName: user?.firstName,
        lastName: user?.lastName,
        state: merchant.businessAddress?.state,
      });
      if (merchant.isRegisteredBusiness && merchant.cacRcNumber) {
        merchant.cacResult = await this.premblyService.verifyCac(
          merchant.cacRcNumber.replace(/^(RC|BN)/i, ''),
        );
      }

      if (wasRejected) {
        merchant.resubmissionCount = (merchant.resubmissionCount || 0) + 1;
      }
      merchant.kycStatus = 'PENDING_REVIEW';
      merchant.submittedAt = new Date();
      merchant.rejectionReason = null;
    }

    await merchant.save();

    if (dto.submit) {
      this.notificationService
        .notifyAdmins({
          event: MKT_EVENTS.MERCHANT_KYC_SUBMITTED,
          type: 'info',
          title: wasRejected
            ? 'Merchant KYC resubmitted'
            : 'Merchant KYC submitted',
          body: `${merchant.businessName} submitted a merchant application for review.`,
          data: {
            merchantId: merchant._id.toString(),
            link: `/bennie/merchants/${merchant._id.toString()}`,
          },
        })
        .catch(() => undefined);
    }

    return this.me(userId);
  }

  /** GET /merchant/kyc/documents/:fileId/url — owner-scoped signed URL. */
  async kycDocumentUrl(
    userId: string,
    fileId: string,
  ): Promise<Record<string, any>> {
    const merchant = this.requireMerchant(await this.findByUser(userId));
    const owned = (merchant.kycDocs || []).some(
      (d: any) => String(d.id) === fileId,
    );
    if (!owned) {
      if (merchant.kycDocsPurgedAt) {
        throw new MarketplaceException('MERCH_017', HttpStatus.GONE);
      }
      throw new MarketplaceException(
        'MERCH_005',
        HttpStatus.NOT_FOUND,
        undefined,
        'Document not found',
      );
    }
    const result = await this.uploadService.signedUrl(fileId, {
      ownerUserId: userId,
    });
    return {
      url: result.url,
      expiresAt: result.expiresAt,
      signed: result.signed,
    };
  }

  // ---------------------------------------------------------------------------
  // Products (APPROVED only)
  // ---------------------------------------------------------------------------

  private merchantProductView(product: any): Record<string, any> {
    const plain = serialize<any>(product);
    // Strip internal-only fields before returning to the merchant client.
    const {
      moderatedBy,
      moderationReason,
      suspended,
      deletedAt,
      merchantId,
      ...safe
    } = plain;
    void moderatedBy;
    void merchantId;
    void deletedAt;
    return {
      ...safe,
      stock: { available: plain.inventory?.available ?? 0 },
      isSuspended: suspended === true,
      moderationNote: moderationReason || null,
    };
  }

  async listProducts(
    userId: string,
    query: ListMerchantProductsDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireMerchant(await this.findByUser(userId));
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {
      merchantId: merchant._id,
      deletedAt: null,
    };
    if (query.moderationStatus) {
      filter.moderationStatus = query.moderationStatus;
    }
    const [docs, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);
    return {
      items: docs.map((d) => this.merchantProductView(d)),
      total,
      page,
      limit,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'product';
    let slug = base;
    let n = 1;
    while (await this.productModel.exists({ slug })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }

  async createProduct(
    userId: string,
    dto: MerchantProductCreateDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireApproved(await this.findByUser(userId));

    const maxListings = this.marketplaceService.cfg(
      'merchantMaxActiveListings',
      100,
    );
    const count = await this.productModel.countDocuments({
      merchantId: merchant._id,
      deletedAt: null,
    });
    if (count >= maxListings) {
      throw new MarketplaceException('MERCH_007', HttpStatus.CONFLICT, {
        max: maxListings,
      });
    }

    const categoryId = toObjectId(dto.categoryId, 'MKT_002');
    const activeCategories = await this.marketplaceService.activeCategoryIds();
    if (!activeCategories.has(dto.categoryId)) {
      throw new MarketplaceException('MKT_002', HttpStatus.NOT_FOUND);
    }

    const media = await validateAndNormalizeMedia(
      this.uploadService,
      dto.images,
      dto.video,
      { cap: 'MERCH_009', notFound: 'MERCH_009' },
      { minImages: 1 },
    );

    const product = await this.productModel.create({
      productId: genBizId('PRD'),
      source: 'MERCHANT',
      merchantId: merchant._id,
      name: dto.name,
      slug: await this.uniqueSlug(dto.name),
      description: dto.description,
      categoryId,
      price: dto.price,
      unit: dto.unit,
      inventory: { available: dto.stock, reserved: 0, lowStockThreshold: null },
      images: media.images,
      video: media.video,
      moderationStatus: 'PENDING',
      status: 'ACTIVE',
      suspended: false,
    });

    this.notificationService
      .notifyAdmins({
        event: MKT_EVENTS.PRODUCT_MODERATION_PENDING,
        type: 'info',
        title: 'Listing awaiting moderation',
        body: `${merchant.businessName} submitted "${product.name}" for approval.`,
        data: {
          productId: product._id.toString(),
          link: '/bennie/market-place?tab=moderation',
        },
      })
      .catch(() => undefined);

    return this.merchantProductView(product);
  }

  async updateProduct(
    userId: string,
    productId: string,
    dto: MerchantProductUpdateDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireApproved(await this.findByUser(userId));
    const _id = toObjectId(productId, 'MERCH_008');
    const product = await this.productModel.findOne({
      _id,
      merchantId: merchant._id,
      deletedAt: null,
    });
    if (!product) {
      throw new MarketplaceException('MERCH_008', HttpStatus.NOT_FOUND);
    }

    let material = false;

    if (dto.name !== undefined && dto.name !== product.name) {
      product.name = dto.name;
      material = true;
    }
    if (
      dto.description !== undefined &&
      dto.description !== product.description
    ) {
      product.description = dto.description;
      material = true;
    }
    if (dto.categoryId !== undefined) {
      const catId = toObjectId(dto.categoryId, 'MKT_002');
      if (dto.categoryId !== product.categoryId.toString()) {
        const activeCategories =
          await this.marketplaceService.activeCategoryIds();
        if (!activeCategories.has(dto.categoryId)) {
          throw new MarketplaceException('MKT_002', HttpStatus.NOT_FOUND);
        }
        product.categoryId = catId;
        material = true;
      }
    }
    if (dto.price !== undefined && dto.price !== product.price) {
      product.price = dto.price;
      material = true;
    }
    if (dto.unit !== undefined && dto.unit !== product.unit) {
      product.unit = dto.unit;
      material = true;
    }

    // Media (material) — replaced entries are cascade-deleted.
    if (dto.images !== undefined || dto.video !== undefined) {
      const media = await validateAndNormalizeMedia(
        this.uploadService,
        dto.images !== undefined ? dto.images : (product.images as any[]),
        dto.video !== undefined ? dto.video : product.video,
        { cap: 'MERCH_009', notFound: 'MERCH_009' },
        { minImages: 1 },
      );
      const removed = removedMediaIds(
        product.images as any[],
        product.video,
        media.images,
        media.video,
      );
      product.images = media.images;
      product.video = media.video;
      material = true;
      for (const id of removed) {
        await this.uploadService.removeQuietly(id);
      }
    }

    // Non-material: stock + ACTIVE/INACTIVE toggle.
    if (dto.stock !== undefined) {
      product.inventory.available = dto.stock;
      product.markModified('inventory');
    }
    if (dto.status !== undefined) {
      product.status = dto.status as any;
    }

    if (material) {
      product.moderationStatus = 'PENDING';
      product.moderationReason = undefined;
    }
    await product.save();

    if (material) {
      this.notificationService
        .notifyAdmins({
          event: MKT_EVENTS.PRODUCT_MODERATION_PENDING,
          type: 'info',
          title: 'Edited listing awaiting re-approval',
          body: `${merchant.businessName} edited "${product.name}" — re-moderation required.`,
          data: {
            productId: product._id.toString(),
            link: '/bennie/market-place?tab=moderation',
          },
        })
        .catch(() => undefined);
    }

    return this.merchantProductView(product);
  }

  async deleteProduct(
    userId: string,
    productId: string,
  ): Promise<Record<string, any>> {
    const merchant = this.requireApproved(await this.findByUser(userId));
    const _id = toObjectId(productId, 'MERCH_008');
    const product = await this.productModel.findOne({
      _id,
      merchantId: merchant._id,
      deletedAt: null,
    });
    if (!product) {
      throw new MarketplaceException('MERCH_008', HttpStatus.NOT_FOUND);
    }
    product.deletedAt = new Date();
    product.status = 'INACTIVE';
    await product.save();
    return { id: product._id.toString(), deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Orders (readable + advanceable while SUSPENDED)
  // ---------------------------------------------------------------------------

  /** APPROVED or SUSPENDED (existing orders must still reach buyers). */
  private requireSelling(merchant: MerchantDocument | null): MerchantDocument {
    const m = this.requireMerchant(merchant);
    if (!['APPROVED', 'SUSPENDED'].includes(m.kycStatus)) {
      throw new MarketplaceException('MERCH_002', HttpStatus.FORBIDDEN);
    }
    return m;
  }

  async listOrders(
    userId: string,
    query: ListMerchantOrdersDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireSelling(await this.findByUser(userId));
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {
      'seller.merchantId': merchant._id,
    };
    if (query.status) {
      filter.fulfillmentStatus = query.status;
    }
    const [docs, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);

    const buyers = await this.ordersService.userMap(
      docs.map((d: any) => d.buyerId),
    );

    return {
      items: docs.map((d: any) => {
        const view = this.ordersService.orderView(d);
        view.buyerName = this.ordersService.buyerDisplayName(
          buyers.get(d.buyerId?.toString()),
        );
        return view;
      }),
      total,
      page,
      limit,
    };
  }

  /** PATCH /merchant/orders/:id/fulfillment — exactly one step forward. */
  async advanceFulfillment(
    userId: string,
    orderId: string,
    dto: MerchantFulfillmentDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireSelling(await this.findByUser(userId));
    const _id = toObjectId(orderId, 'MERCH_011');
    const order = await this.orderModel.findOne({
      _id,
      'seller.merchantId': merchant._id,
    });
    if (!order) {
      throw new MarketplaceException('MERCH_011', HttpStatus.NOT_FOUND);
    }
    if (order.fulfillmentStatus === 'CANCELLED') {
      throw new MarketplaceException('MERCH_010', HttpStatus.CONFLICT, {
        current: 'CANCELLED',
      });
    }
    const next = this.ordersService.nextForwardStatus(order.fulfillmentStatus);
    if (!next || next !== dto.status) {
      throw new MarketplaceException('MERCH_010', HttpStatus.CONFLICT, {
        from: order.fulfillmentStatus,
        to: dto.status,
        allowed: next,
      });
    }

    // Guarded transition (concurrency-safe).
    const updated = await this.orderModel.findOneAndUpdate(
      { _id, fulfillmentStatus: order.fulfillmentStatus },
      {
        $set: {
          fulfillmentStatus: next,
          ...(next === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        },
        $push: {
          timeline: {
            status: next,
            at: new Date(),
            actorType: 'merchant',
            actorId: merchant._id.toString(),
          },
        },
      },
      { new: true },
    );
    if (!updated) {
      throw new MarketplaceException('MERCH_010', HttpStatus.CONFLICT);
    }

    if (next === 'DELIVERED') {
      await this.ordersService.bookEarningsIfNeeded(updated);
    }
    await this.ordersService.notifyBuyerStatus(updated);

    return this.ordersService.orderView(updated);
  }

  // ---------------------------------------------------------------------------
  // Earnings
  // ---------------------------------------------------------------------------

  private earningView(entry: any): Record<string, any> {
    const plain = serialize<any>(entry);
    return {
      ...plain,
      grossAmount: plain.gross,
      netAmount: plain.net,
    };
  }

  async earnings(
    userId: string,
    query: ListEarningsDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireSelling(await this.findByUser(userId));
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [docs, total] = await Promise.all([
      this.earningModel
        .find({ merchantId: merchant._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.earningModel.countDocuments({ merchantId: merchant._id }),
    ]);

    return {
      summary: {
        totalEarned: merchant.earnings?.lifetimeEarned || 0,
        totalPaidOut: merchant.earnings?.lifetimePaidOut || 0,
        pendingPayout: merchant.earnings?.pendingPayout || 0,
        available: merchant.earnings?.availableBalance || 0,
        platformFeePercent: this.marketplaceService.cfg(
          'platformFeePercent',
          5,
        ),
      },
      entries: docs.map((d) => this.earningView(d)),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // Payout requests (manual, adashe-style)
  // ---------------------------------------------------------------------------

  private payoutView(request: any): Record<string, any> {
    const plain = serialize<any>(request);
    return { ...plain, bankDetails: plain.bankAccount };
  }

  async listPayoutRequests(userId: string): Promise<Record<string, any>> {
    const merchant = this.requireMerchant(await this.findByUser(userId));
    const docs = await this.payoutModel
      .find({ merchantId: merchant._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return { items: docs.map((d) => this.payoutView(d)) };
  }

  async createPayoutRequest(
    userId: string,
    dto: CreatePayoutRequestDto,
  ): Promise<Record<string, any>> {
    const merchant = this.requireApproved(await this.findByUser(userId));

    const minPayout = this.marketplaceService.cfg('merchantMinPayoutNgn', 1000);
    if (dto.amount < minPayout) {
      throw new MarketplaceException(
        'MERCH_018',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { minimum: minPayout },
      );
    }
    const available = merchant.earnings?.availableBalance || 0;
    if (dto.amount > available) {
      throw new MarketplaceException('MERCH_012', HttpStatus.CONFLICT, {
        requested: dto.amount,
        available,
      });
    }
    const open = await this.payoutModel.findOne({
      merchantId: merchant._id,
      status: { $in: ['REQUESTED', 'MARKED_SENT'] },
    });
    if (open) {
      throw new MarketplaceException('MERCH_015', HttpStatus.CONFLICT, {
        requestId: open.requestId,
      });
    }

    let request: MerchantPayoutRequestDocument;
    try {
      request = await this.payoutModel.create({
        requestId: genBizId('MPR'),
        merchantId: merchant._id,
        amount: dto.amount,
        entryIds: [],
        bankAccount: dto.bankDetails,
        status: 'REQUESTED',
        requestedAt: new Date(),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new MarketplaceException('MERCH_015', HttpStatus.CONFLICT);
      }
      throw error;
    }

    // Lock AVAILABLE entries oldest-first until the amount is covered.
    const entries = await this.earningModel
      .find({ merchantId: merchant._id, status: 'AVAILABLE' })
      .sort({ createdAt: 1 });
    const lockedIds: Types.ObjectId[] = [];
    let covered = 0;
    for (const entry of entries) {
      if (covered >= dto.amount) {
        break;
      }
      entry.status = 'LOCKED';
      entry.payoutRequestId = request._id as Types.ObjectId;
      await entry.save();
      lockedIds.push(entry._id as Types.ObjectId);
      covered += entry.net;
    }
    request.entryIds = lockedIds;
    await request.save();

    // Hold the amount + snapshot the bank account.
    merchant.earnings.availableBalance -= dto.amount;
    merchant.earnings.pendingPayout =
      (merchant.earnings.pendingPayout || 0) + dto.amount;
    merchant.markModified('earnings');
    merchant.payoutBankAccount = dto.bankDetails;
    await merchant.save();

    this.notificationService
      .notifyAdmins({
        event: MKT_EVENTS.PAYOUT_REQUESTED,
        type: 'info',
        title: 'Merchant payout requested',
        body: `${merchant.businessName} requested a payout of ₦${dto.amount.toLocaleString()}.`,
        data: {
          merchantId: merchant._id.toString(),
          payoutRequestId: request._id.toString(),
          link: `/bennie/merchants/${merchant._id.toString()}`,
        },
      })
      .catch(() => undefined);

    return {
      request: this.payoutView(request),
      summary: {
        totalEarned: merchant.earnings.lifetimeEarned,
        totalPaidOut: merchant.earnings.lifetimePaidOut,
        pendingPayout: merchant.earnings.pendingPayout,
        available: merchant.earnings.availableBalance,
      },
    };
  }

  /** Release a payout's hold: entries → AVAILABLE, counters restored. */
  async releasePayoutHold(
    request: MerchantPayoutRequestDocument,
  ): Promise<void> {
    if (request.entryIds?.length) {
      await this.earningModel.updateMany(
        { _id: { $in: request.entryIds }, status: 'LOCKED' },
        { $set: { status: 'AVAILABLE', payoutRequestId: null } },
      );
    }
    await this.merchantModel.updateOne(
      { _id: request.merchantId },
      {
        $inc: {
          'earnings.availableBalance': request.amount,
          'earnings.pendingPayout': -request.amount,
        },
      },
    );
  }

  async cancelPayoutRequest(
    userId: string,
    requestId: string,
  ): Promise<Record<string, any>> {
    const merchant = this.requireMerchant(await this.findByUser(userId));
    const _id = toObjectId(requestId, 'MERCH_013');
    const request = await this.payoutModel.findOne({
      _id,
      merchantId: merchant._id,
    });
    if (!request) {
      throw new MarketplaceException('MERCH_013', HttpStatus.NOT_FOUND);
    }
    if (request.status !== 'REQUESTED') {
      throw new MarketplaceException('MERCH_014', HttpStatus.CONFLICT, {
        current: request.status,
      });
    }
    request.status = 'CANCELLED';
    request.cancelledBy = 'merchant';
    await request.save();
    await this.releasePayoutHold(request);

    this.notificationService
      .notifyAdmins({
        event: MKT_EVENTS.PAYOUT_CANCELLED,
        type: 'info',
        title: 'Merchant payout cancelled',
        body: `${merchant.businessName} cancelled payout request ${request.requestId}.`,
        data: {
          merchantId: merchant._id.toString(),
          link: `/bennie/merchants/${merchant._id.toString()}`,
        },
      })
      .catch(() => undefined);

    return this.payoutView(request);
  }

  async confirmPayoutReceived(
    userId: string,
    requestId: string,
  ): Promise<Record<string, any>> {
    const merchant = this.requireMerchant(await this.findByUser(userId));
    const _id = toObjectId(requestId, 'MERCH_013');
    const request = await this.payoutModel.findOne({
      _id,
      merchantId: merchant._id,
    });
    if (!request) {
      throw new MarketplaceException('MERCH_013', HttpStatus.NOT_FOUND);
    }
    if (request.status === 'CONFIRMED_RECEIVED') {
      return this.payoutView(request); // idempotent repeat — no re-notify
    }
    if (request.status !== 'MARKED_SENT') {
      throw new MarketplaceException('MERCH_014', HttpStatus.CONFLICT, {
        current: request.status,
      });
    }

    request.status = 'CONFIRMED_RECEIVED';
    request.confirmedAt = new Date();
    await request.save();

    // Settle the locked entries + move the hold into lifetimePaidOut.
    if (request.entryIds?.length) {
      await this.earningModel.updateMany(
        { _id: { $in: request.entryIds }, status: 'LOCKED' },
        { $set: { status: 'SETTLED', settledAt: new Date() } },
      );
    }
    await this.merchantModel.updateOne(
      { _id: merchant._id },
      {
        $inc: {
          'earnings.pendingPayout': -request.amount,
          'earnings.lifetimePaidOut': request.amount,
        },
      },
    );

    this.notificationService
      .notifyAdmins({
        event: MKT_EVENTS.PAYOUT_CONFIRMED,
        type: 'success',
        title: 'Merchant confirmed payout received',
        body: `${merchant.businessName} confirmed receiving ₦${request.amount.toLocaleString()} (${request.paymentReference || 'no ref'}).`,
        data: {
          merchantId: merchant._id.toString(),
          payoutRequestId: request._id.toString(),
          link: `/bennie/merchants/${merchant._id.toString()}`,
        },
      })
      .catch(() => undefined);

    return this.payoutView(request);
  }
}
