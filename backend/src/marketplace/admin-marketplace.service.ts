import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProductCategory,
  ProductCategoryDocument,
} from './schemas/product-category.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import {
  ProductModeration,
  ProductModerationDocument,
} from './schemas/product-moderation.schema';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import { UploadService } from '../storage/upload.service';
import { NotificationService } from '../notifications/notification.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceException, MKT_EVENTS } from './marketplace.constants';
import {
  genBizId,
  removedMediaIds,
  slugify,
  toObjectId,
  validateAndNormalizeMedia,
} from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import {
  AdminProductCreateDto,
  AdminProductUpdateDto,
  CategoryCreateDto,
  CategoryUpdateDto,
  InventoryPatchDto,
  ListProductsAdminDto,
  ListSellersDto,
  RejectProductDto,
} from './dto/admin-marketplace.dto';

/**
 * Admin marketplace ops (PRD/admin_module/marketplace/marketplace.md):
 * category CRUD, product CRUD (admin products skip moderation), the
 * moderation queue, inventory oversight and read-only seller aggregates.
 */
@Injectable()
export class AdminMarketplaceService {
  private readonly logger = new Logger(AdminMarketplaceService.name);

  constructor(
    @InjectModel(ProductCategory.name)
    private readonly categoryModel: Model<ProductCategoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductModeration.name)
    private readonly moderationModel: Model<ProductModerationDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly uploadService: UploadService,
    private readonly notificationService: NotificationService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Categories (marketplace:configure)
  // ---------------------------------------------------------------------------

  async listCategories(): Promise<Record<string, any>> {
    const categories = await this.categoryModel
      .find()
      .sort({ sortOrder: 1 })
      .lean();
    const counts = await this.productModel.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      counts.map((c: any) => [c._id?.toString(), c.count]),
    );
    return {
      items: categories.map((c: any) => ({
        ...serialize<any>(c),
        productCount: countMap.get(c._id.toString()) || 0,
      })),
    };
  }

  async createCategory(
    dto: CategoryCreateDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const slug = slugify(dto.name);
    const clash = await this.categoryModel.findOne({
      $or: [{ name: dto.name }, { slug }],
    });
    if (clash) {
      throw new MarketplaceException('MKT_ADM_009', HttpStatus.CONFLICT);
    }
    const maxSort = await this.categoryModel
      .findOne()
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    const category = await this.categoryModel.create({
      name: dto.name,
      slug,
      description: dto.description,
      icon: dto.icon,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? ((maxSort as any)?.sortOrder || 0) + 1,
      createdBy: new Types.ObjectId(adminId),
    });
    return serialize(category);
  }

  async updateCategory(
    id: string,
    dto: CategoryUpdateDto,
  ): Promise<{ before: any; after: any }> {
    const _id = toObjectId(id, 'MKT_ADM_019');
    const category = await this.categoryModel.findById(_id);
    if (!category) {
      throw new MarketplaceException('MKT_ADM_019', HttpStatus.NOT_FOUND);
    }
    const before = serialize<any>(category.toObject());

    if (dto.name !== undefined && dto.name !== category.name) {
      const slug = slugify(dto.name);
      const clash = await this.categoryModel.findOne({
        _id: { $ne: _id },
        $or: [{ name: dto.name }, { slug }],
      });
      if (clash) {
        throw new MarketplaceException('MKT_ADM_009', HttpStatus.CONFLICT);
      }
      category.name = dto.name;
      category.slug = slug;
    }
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.icon !== undefined) category.icon = dto.icon;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    await category.save();
    return { before, after: serialize(category) };
  }

  async deleteCategory(id: string): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'MKT_ADM_019');
    const category = await this.categoryModel.findById(_id);
    if (!category) {
      throw new MarketplaceException('MKT_ADM_019', HttpStatus.NOT_FOUND);
    }
    const inUse = await this.productModel.countDocuments({
      categoryId: _id,
      deletedAt: null,
    });
    if (inUse > 0) {
      throw new MarketplaceException('MKT_ADM_010', HttpStatus.CONFLICT, {
        products: inUse,
      });
    }
    await this.categoryModel.deleteOne({ _id });
    return { id, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  private async adminProductView(product: any): Promise<Record<string, any>> {
    const merchantNames = await this.marketplaceService.merchantNameMap(
      product.merchantId ? [product.merchantId] : [],
    );
    const categoryNames = await this.marketplaceService.categoryNameMap([
      product.categoryId,
    ]);
    const plain = serialize<any>(product);
    return {
      ...plain,
      category: {
        id: plain.categoryId?.toString(),
        name: categoryNames.get(plain.categoryId?.toString()) || null,
      },
      seller: this.marketplaceService.sellerView(plain, merchantNames),
      stock: { available: plain.inventory?.available ?? 0 },
    };
  }

  async listProducts(
    query: ListProductsAdminDto,
  ): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = { deletedAt: null };

    if (query.q) {
      filter.$or = [
        { name: { $regex: query.q, $options: 'i' } },
        { slug: { $regex: query.q, $options: 'i' } },
        { productId: { $regex: query.q, $options: 'i' } },
      ];
    }
    if (query.moderationStatus)
      filter.moderationStatus = query.moderationStatus;
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.merchantId) {
      filter.merchantId = new Types.ObjectId(query.merchantId);
    }
    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.suspended !== undefined) {
      filter.suspended = query.suspended;
    }
    if (query.lowStock) {
      const threshold = this.marketplaceService.cfg('lowStockThreshold', 10);
      filter.$expr = {
        $lte: [
          '$inventory.available',
          { $ifNull: ['$inventory.lowStockThreshold', threshold] },
        ],
      };
    }

    const sortField =
      query.sortBy === 'totalSales'
        ? 'totalSales'
        : query.sortBy === 'price'
          ? 'price'
          : 'createdAt';
    const sort: Record<string, 1 | -1> = {
      [sortField]: query.order === 'asc' ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    const merchantNames = await this.marketplaceService.merchantNameMap(
      docs.map((d: any) => d.merchantId).filter(Boolean),
    );
    const categoryNames = await this.marketplaceService.categoryNameMap(
      docs.map((d: any) => d.categoryId).filter(Boolean),
    );

    return {
      items: docs.map((d: any) => {
        const plain = serialize<any>(d);
        return {
          ...plain,
          category: {
            id: plain.categoryId?.toString(),
            name: categoryNames.get(plain.categoryId?.toString()) || null,
          },
          seller: this.marketplaceService.sellerView(plain, merchantNames),
          stock: { available: plain.inventory?.available ?? 0 },
        };
      }),
      total,
      page,
      limit,
    };
  }

  async productDetail(id: string): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findById(_id).lean();
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }
    const view = await this.adminProductView(product);

    view.moderationHistory = serialize(
      await this.moderationModel
        .find({ productId: _id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    );

    if ((product as any).merchantId) {
      const merchant = await this.merchantModel
        .findById((product as any).merchantId)
        .select('merchantId businessName kycStatus earnings')
        .lean();
      view.merchant = merchant ? serialize(merchant) : null;
    }
    return view;
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

  /** Admin-create a platform product — APPROVED at creation (skips moderation). */
  async createProduct(
    dto: AdminProductCreateDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    const categoryId = toObjectId(dto.categoryId, 'MKT_ADM_019');
    const category = await this.categoryModel.findById(categoryId).lean();
    if (!category) {
      throw new MarketplaceException('MKT_ADM_019', HttpStatus.NOT_FOUND);
    }
    if (!(category as any).isActive) {
      throw new MarketplaceException('MKT_ADM_018', HttpStatus.CONFLICT);
    }

    const media = await validateAndNormalizeMedia(
      this.uploadService,
      dto.images,
      dto.video,
      { cap: 'MKT_ADM_014', notFound: 'MKT_ADM_015' },
    );

    const product = await this.productModel.create({
      productId: genBizId('PRD'),
      source: 'ADMIN',
      createdByAdminId: new Types.ObjectId(adminId),
      name: dto.name,
      slug: await this.uniqueSlug(dto.name),
      description: dto.description,
      categoryId,
      price: dto.price,
      unit: dto.unit,
      inventory: {
        available: dto.inventory?.available ?? 0,
        reserved: 0,
        lowStockThreshold: dto.inventory?.lowStockThreshold ?? null,
      },
      images: media.images,
      video: media.video,
      moderationStatus: 'APPROVED',
      moderatedAt: new Date(),
      status: 'ACTIVE',
      suspended: false,
    });

    // Traceability for the "skips moderation" rule.
    await this.moderationModel.create({
      productId: product._id,
      merchantId: null,
      decision: 'AUTO_APPROVED',
      reviewedBy: null,
      reviewedAt: new Date(),
    });

    return this.adminProductView(product);
  }

  async updateProduct(
    id: string,
    dto: AdminProductUpdateDto,
  ): Promise<{ before: any; after: any }> {
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findOne({ _id, deletedAt: null });
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }
    const before = serialize<any>(product.toObject());

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.categoryId !== undefined) {
      const categoryId = toObjectId(dto.categoryId, 'MKT_ADM_019');
      const category = await this.categoryModel.findById(categoryId).lean();
      if (!category) {
        throw new MarketplaceException('MKT_ADM_019', HttpStatus.NOT_FOUND);
      }
      product.categoryId = categoryId;
    }
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.unit !== undefined) product.unit = dto.unit;
    if (dto.status !== undefined) product.status = dto.status as any;
    if (dto.suspended !== undefined) product.suspended = dto.suspended;
    if (dto.inventory?.available !== undefined) {
      product.inventory.available = dto.inventory.available;
      product.markModified('inventory');
    }
    if (dto.inventory?.lowStockThreshold !== undefined) {
      product.inventory.lowStockThreshold = dto.inventory.lowStockThreshold;
      product.markModified('inventory');
    }

    if (dto.images !== undefined || dto.video !== undefined) {
      const media = await validateAndNormalizeMedia(
        this.uploadService,
        dto.images !== undefined ? dto.images : (product.images as any[]),
        dto.video !== undefined ? dto.video : product.video,
        { cap: 'MKT_ADM_014', notFound: 'MKT_ADM_015' },
      );
      const removed = removedMediaIds(
        product.images as any[],
        product.video,
        media.images,
        media.video,
      );
      product.images = media.images;
      product.video = media.video;
      // Replaced media is cascade-deleted (log-and-continue per file).
      for (const fileId of removed) {
        await this.uploadService.removeQuietly(fileId);
      }
    }

    // Admin edits never trigger re-moderation (admins are the moderators).
    await product.save();
    return { before, after: await this.adminProductView(product) };
  }

  /**
   * Hard delete + media cascade. Blocked while non-terminal orders contain
   * the product. Media failures are logged and skipped — the delete proceeds.
   */
  async deleteProduct(id: string): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findById(_id);
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }

    const openOrders = await this.orderModel.countDocuments({
      'items.productId': _id,
      fulfillmentStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
    });
    if (openOrders > 0) {
      throw new MarketplaceException('MKT_ADM_017', HttpStatus.CONFLICT, {
        openOrders,
      });
    }

    const mediaIds = [...(product.images || []), product.video]
      .filter(Boolean)
      .map((m: any) => String(m.id));
    const purged: string[] = [];
    for (const fileId of mediaIds) {
      const ok = await this.uploadService.removeQuietly(fileId);
      if (ok) {
        purged.push(fileId);
      }
    }

    await this.productModel.deleteOne({ _id });
    return { id, deleted: true, cascadedMedia: purged };
  }

  // ---------------------------------------------------------------------------
  // Moderation
  // ---------------------------------------------------------------------------

  async moderationQueue(page = 1, limit = 20): Promise<Record<string, any>> {
    const filter = { moderationStatus: 'PENDING', deletedAt: null };
    const [docs, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ createdAt: 1 }) // oldest first
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);
    const merchantNames = await this.marketplaceService.merchantNameMap(
      docs.map((d: any) => d.merchantId).filter(Boolean),
    );
    const categoryNames = await this.marketplaceService.categoryNameMap(
      docs.map((d: any) => d.categoryId).filter(Boolean),
    );
    return {
      items: docs.map((d: any) => {
        const plain = serialize<any>(d);
        return {
          ...plain,
          category: {
            id: plain.categoryId?.toString(),
            name: categoryNames.get(plain.categoryId?.toString()) || null,
          },
          seller: this.marketplaceService.sellerView(plain, merchantNames),
        };
      }),
      total,
      page,
      limit,
    };
  }

  private async notifyMerchantModeration(
    product: ProductDocument,
    decision: string,
    reason?: string,
  ): Promise<void> {
    if (!product.merchantId) {
      return;
    }
    try {
      const merchant = await this.merchantModel
        .findById(product.merchantId)
        .select('userId')
        .lean();
      if (!merchant?.userId) {
        return;
      }
      const approved = decision === 'APPROVED';
      await this.notificationService.notify({
        recipientType: 'user',
        recipientId: (merchant as any).userId,
        event: MKT_EVENTS.PRODUCT_MODERATION_DECIDED,
        type: approved ? 'success' : 'warning',
        title: approved
          ? 'Listing approved'
          : decision === 'CHANGES_REQUESTED'
            ? 'Changes requested on your listing'
            : 'Listing rejected',
        body: approved
          ? `"${product.name}" is now live on the marketplace.`
          : `"${product.name}": ${reason || 'see the moderation note.'}`,
        data: {
          productId: product._id.toString(),
          decision,
          link: `/app/merchant?tab=products`,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Moderation notification failed: ${error?.message}`);
    }
  }

  async approveProduct(
    id: string,
    adminId: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findOne({ _id, deletedAt: null });
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }
    if (!['PENDING', 'CHANGES_REQUESTED'].includes(product.moderationStatus)) {
      throw new MarketplaceException('MKT_ADM_016', HttpStatus.CONFLICT, {
        current: product.moderationStatus,
      });
    }
    product.moderationStatus = 'APPROVED';
    product.moderationReason = undefined;
    product.moderatedBy = new Types.ObjectId(adminId);
    product.moderatedAt = new Date();
    await product.save();

    await this.moderationModel.create({
      productId: product._id,
      merchantId: product.merchantId || null,
      decision: 'APPROVED',
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
    });
    await this.notifyMerchantModeration(product, 'APPROVED');

    return {
      id: product._id.toString(),
      moderationStatus: product.moderationStatus,
      moderatedAt: product.moderatedAt,
    };
  }

  async rejectProduct(
    id: string,
    dto: RejectProductDto,
    adminId: string,
  ): Promise<Record<string, any>> {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new MarketplaceException(
        'MKT_ADM_008',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findOne({ _id, deletedAt: null });
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }
    if (!['PENDING', 'CHANGES_REQUESTED'].includes(product.moderationStatus)) {
      throw new MarketplaceException('MKT_ADM_016', HttpStatus.CONFLICT, {
        current: product.moderationStatus,
      });
    }
    const decision = dto.requestChanges ? 'CHANGES_REQUESTED' : 'REJECTED';
    product.moderationStatus = decision as any;
    product.moderationReason = dto.reason.trim();
    product.moderatedBy = new Types.ObjectId(adminId);
    product.moderatedAt = new Date();
    await product.save();

    await this.moderationModel.create({
      productId: product._id,
      merchantId: product.merchantId || null,
      decision: decision as any,
      reason: dto.reason.trim(),
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
    });
    await this.notifyMerchantModeration(product, decision, dto.reason.trim());

    return {
      id: product._id.toString(),
      moderationStatus: product.moderationStatus,
      moderatedAt: product.moderatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------

  async lowStock(): Promise<Record<string, any>> {
    const threshold = this.marketplaceService.cfg('lowStockThreshold', 10);
    const docs = await this.productModel
      .find({
        deletedAt: null,
        $expr: {
          $lte: [
            '$inventory.available',
            { $ifNull: ['$inventory.lowStockThreshold', threshold] },
          ],
        },
      })
      .sort({ 'inventory.available': 1 })
      .limit(200)
      .lean();
    return {
      items: docs.map((d: any) => {
        const plain = serialize<any>(d);
        return {
          id: plain.id,
          productId: plain.productId,
          name: plain.name,
          source: plain.source,
          available: plain.inventory?.available ?? 0,
          lowStockThreshold: plain.inventory?.lowStockThreshold ?? threshold,
          status: plain.status,
        };
      }),
      defaultThreshold: threshold,
    };
  }

  async patchInventory(
    id: string,
    dto: InventoryPatchDto,
  ): Promise<{ before: any; after: any }> {
    const _id = toObjectId(id, 'MKT_ADM_001');
    const product = await this.productModel.findOne({ _id, deletedAt: null });
    if (!product) {
      throw new MarketplaceException('MKT_ADM_001', HttpStatus.NOT_FOUND);
    }
    const before = serialize<any>(product.inventory);
    if (dto.available !== undefined) {
      product.inventory.available = dto.available;
    }
    if (dto.lowStockThreshold !== undefined) {
      product.inventory.lowStockThreshold = dto.lowStockThreshold;
    }
    product.markModified('inventory');
    await product.save();
    return { before, after: serialize(product.inventory) };
  }

  // ---------------------------------------------------------------------------
  // Sellers (read-only; actions live in the Merchants section)
  // ---------------------------------------------------------------------------

  async listSellers(query: ListSellersDto): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {};
    if (query.q) {
      filter.$or = [
        { businessName: { $regex: query.q, $options: 'i' } },
        { merchantId: { $regex: query.q, $options: 'i' } },
      ];
    }
    const [docs, total] = await Promise.all([
      this.merchantModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.merchantModel.countDocuments(filter),
    ]);

    const ids = docs.map((d: any) => d._id);
    const [listingCounts, orderAggregates] = await Promise.all([
      this.productModel.aggregate([
        { $match: { merchantId: { $in: ids }, deletedAt: null } },
        { $group: { _id: '$merchantId', count: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate([
        { $match: { 'seller.merchantId': { $in: ids } } },
        {
          $group: {
            _id: '$seller.merchantId',
            orders: { $sum: 1 },
            gmv: { $sum: '$pricing.total' },
          },
        },
      ]),
    ]);
    const listingMap = new Map(
      listingCounts.map((c: any) => [c._id.toString(), c.count]),
    );
    const orderMap = new Map(
      orderAggregates.map((c: any) => [c._id.toString(), c]),
    );

    return {
      items: docs.map((d: any) => {
        const key = d._id.toString();
        const agg = orderMap.get(key) || { orders: 0, gmv: 0 };
        return {
          id: key,
          merchantId: d.merchantId,
          businessName: d.businessName,
          kycStatus: d.kycStatus,
          listings: listingMap.get(key) || 0,
          orders: agg.orders,
          gmv: agg.gmv,
          earnings: d.earnings,
          createdAt: d.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async sellerDetail(merchantId: string): Promise<Record<string, any>> {
    const _id = toObjectId(merchantId, 'MKT_ADM_003');
    const merchant = await this.merchantModel.findById(_id).lean();
    if (!merchant) {
      throw new MarketplaceException('MKT_ADM_003', HttpStatus.NOT_FOUND);
    }
    const [listings, recentOrders] = await Promise.all([
      this.productModel
        .find({ merchantId: _id, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.orderModel
        .find({ 'seller.merchantId': _id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    const plain = serialize<any>(merchant);
    return {
      merchant: {
        id: plain.id,
        merchantId: plain.merchantId,
        businessName: plain.businessName,
        kycStatus: plain.kycStatus,
        earnings: plain.earnings,
        createdAt: plain.createdAt,
      },
      listings: listings.map((l: any) => {
        const p = serialize<any>(l);
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          moderationStatus: p.moderationStatus,
          status: p.status,
          suspended: p.suspended,
          available: p.inventory?.available ?? 0,
        };
      }),
      recentOrders: recentOrders.map((o: any) => ({
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        fulfillmentStatus: o.fulfillmentStatus,
        paymentStatus: o.paymentStatus,
        total: o.pricing?.total,
        createdAt: o.createdAt,
      })),
    };
  }
}
