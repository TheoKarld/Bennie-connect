import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import {
  ProductCategory,
  ProductCategoryDocument,
} from './schemas/product-category.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { Cart, CartDocument } from './schemas/cart.schema';
import {
  MarketplaceException,
  SEED_CATEGORY_NAMES,
} from './marketplace.constants';
import {
  BUYER_VISIBILITY_FILTER,
  slugify,
  toObjectId,
} from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import { BrowseProductsDto } from './dto/marketplace.dto';

/**
 * Storefront read-surface (ecommerce-marketplace.md): categories rail,
 * browse/search/filter/sort, product detail. Also owns the idempotent
 * category seeding (the 8 locked names) on module init.
 */
@Injectable()
export class MarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectModel(ProductCategory.name)
    private readonly categoryModel: Model<ProductCategoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    private readonly configService: ConfigService,
  ) {}

  cfg<T = any>(path: string, fallback?: T): T {
    const v = this.configService.get<T>(`configuration.marketplace.${path}`);
    return v === undefined || v === null ? (fallback as T) : v;
  }

  get platformStoreName(): string {
    return this.cfg('platformStoreName', 'Bennie Cooperative Store');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.seedCategories();
    } catch (error: any) {
      this.logger.error(`Category seeding failed: ${error?.message}`);
    }
  }

  /** Idempotent seed of the 8 locked category names. */
  private async seedCategories(): Promise<void> {
    let seeded = 0;
    for (let i = 0; i < SEED_CATEGORY_NAMES.length; i++) {
      const name = SEED_CATEGORY_NAMES[i];
      const res = await this.categoryModel.updateOne(
        { name },
        {
          $setOnInsert: {
            name,
            slug: slugify(name),
            isActive: true,
            sortOrder: i + 1,
            createdBy: null,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount > 0) {
        seeded += 1;
      }
    }
    if (seeded > 0) {
      this.logger.log(`Seeded ${seeded} marketplace categories.`);
    } else {
      this.logger.log('Marketplace categories already seeded.');
    }
  }

  // ---------------------------------------------------------------------------
  // Shared lookups (used by cart/orders/merchant services too)
  // ---------------------------------------------------------------------------

  /** Ids of currently ACTIVE categories. */
  async activeCategoryIds(): Promise<Set<string>> {
    const rows = await this.categoryModel
      .find({ isActive: true })
      .select('_id')
      .lean();
    return new Set(rows.map((r: any) => r._id.toString()));
  }

  /** Batch merchant display names by merchant _id string. */
  async merchantNameMap(
    ids: (string | Types.ObjectId)[],
  ): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids.map((i) => i.toString()))).filter(
      (i) => Types.ObjectId.isValid(i),
    );
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.merchantModel
      .find({ _id: { $in: unique.map((i) => new Types.ObjectId(i)) } })
      .select('businessName')
      .lean();
    return new Map(
      rows.map((r: any) => [r._id.toString(), r.businessName || 'Merchant']),
    );
  }

  /** Seller card for a serialized product. */
  sellerView(
    product: any,
    merchantNames: Map<string, string>,
  ): Record<string, any> {
    if (product.source === 'MERCHANT' && product.merchantId) {
      const mid = product.merchantId.toString();
      return {
        type: 'MERCHANT',
        merchantId: mid,
        displayName: merchantNames.get(mid) || 'Merchant',
      };
    }
    return { type: 'PLATFORM', displayName: this.platformStoreName };
  }

  /** Storefront card/detail view of a product (serialized). */
  productView(
    product: any,
    merchantNames: Map<string, string>,
    categoryNames: Map<string, string>,
    options: { detail?: boolean } = {},
  ): Record<string, any> {
    const plain = serialize<any>(product);
    const categoryId = plain.categoryId?.toString();
    const view: Record<string, any> = {
      id: plain.id,
      productId: plain.productId,
      name: plain.name,
      slug: plain.slug,
      description: plain.description,
      category: categoryId
        ? { id: categoryId, name: categoryNames.get(categoryId) || null }
        : null,
      price: plain.price,
      unit: plain.unit,
      // Canonical schema field + the user-PRD `stock` echo, both serialized.
      inventory: plain.inventory,
      stock: { available: plain.inventory?.available ?? 0 },
      images: plain.images || [],
      seller: this.sellerView(plain, merchantNames),
      totalSold: plain.totalSales ?? 0,
      totalSales: plain.totalSales ?? 0,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
    if (options.detail) {
      view.video = plain.video || null;
    } else {
      view.hasVideo = Boolean(plain.video);
    }
    return view;
  }

  // ---------------------------------------------------------------------------
  // Endpoints
  // ---------------------------------------------------------------------------

  /** GET /marketplace/categories — active categories + visible product counts. */
  async listCategories(): Promise<{ items: Record<string, any>[] }> {
    const categories = await this.categoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    const counts = await this.productModel.aggregate([
      { $match: { ...BUYER_VISIBILITY_FILTER } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      counts.map((c: any) => [c._id?.toString(), c.count]),
    );

    return {
      items: categories.map((c: any) => ({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        icon: c.icon || null,
        sortOrder: c.sortOrder,
        productCount: countMap.get(c._id.toString()) || 0,
      })),
    };
  }

  /** GET /marketplace/products — visible catalogue only. */
  async browseProducts(query: BrowseProductsDto): Promise<Record<string, any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const activeCategories = await this.activeCategoryIds();
    const filter: Record<string, any> = {
      ...BUYER_VISIBILITY_FILTER,
      categoryId: {
        $in: Array.from(activeCategories).map((i) => new Types.ObjectId(i)),
      },
    };

    if (query.category && Types.ObjectId.isValid(query.category)) {
      // Unknown/inactive category → empty result set, not an error.
      filter.categoryId = activeCategories.has(query.category)
        ? new Types.ObjectId(query.category)
        : new Types.ObjectId('000000000000000000000000');
    } else if (query.category) {
      filter.categoryId = new Types.ObjectId('000000000000000000000000');
    }

    if (query.inStockOnly) {
      filter['inventory.available'] = { $gt: 0 };
    }
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    let sort: Record<string, any>;
    switch (query.sort) {
      case 'price_asc':
        sort = { price: 1, _id: 1 };
        break;
      case 'price_desc':
        sort = { price: -1, _id: 1 };
        break;
      case 'popular':
        sort = { totalSales: -1, _id: 1 };
        break;
      default:
        sort = { createdAt: -1, _id: 1 };
    }

    const [docs, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    const merchantNames = await this.merchantNameMap(
      docs.map((d: any) => d.merchantId).filter(Boolean),
    );
    const categoryNames = await this.categoryNameMap(
      docs.map((d: any) => d.categoryId).filter(Boolean),
    );

    return {
      items: docs.map((d) => this.productView(d, merchantNames, categoryNames)),
      total,
      page,
      limit,
    };
  }

  async categoryNameMap(
    ids: (string | Types.ObjectId)[],
  ): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids.map((i) => i.toString())));
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.categoryModel
      .find({ _id: { $in: unique.map((i) => new Types.ObjectId(i)) } })
      .select('name')
      .lean();
    return new Map(rows.map((r: any) => [r._id.toString(), r.name]));
  }

  /** GET /marketplace/products/:id — detail (visibility-guarded, MKT_001). */
  async productDetail(
    id: string,
    userId: string,
  ): Promise<Record<string, any>> {
    const _id = toObjectId(id, 'MKT_001');
    const doc = await this.productModel
      .findOne({ _id, ...BUYER_VISIBILITY_FILTER })
      .lean();
    if (!doc) {
      throw new MarketplaceException('MKT_001', HttpStatus.NOT_FOUND);
    }

    const activeCategories = await this.activeCategoryIds();
    if (!activeCategories.has((doc as any).categoryId?.toString())) {
      throw new MarketplaceException('MKT_001', HttpStatus.NOT_FOUND);
    }

    const merchantNames = await this.merchantNameMap(
      (doc as any).merchantId ? [(doc as any).merchantId] : [],
    );
    const categoryNames = await this.categoryNameMap([(doc as any).categoryId]);

    const view = this.productView(doc, merchantNames, categoryNames, {
      detail: true,
    });

    // inCart echo for the calling user.
    view.inCart = null;
    const cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean();
    if (cart) {
      const line = (cart.items || []).find(
        (i: any) => i.productId?.toString() === id,
      );
      if (line) {
        view.inCart = {
          itemId: (line as any)._id?.toString(),
          quantity: line.quantity,
        };
      }
    }
    return view;
  }
}
