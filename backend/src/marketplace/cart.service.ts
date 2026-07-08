import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notifications/notification.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceException, MKT_EVENTS } from './marketplace.constants';
import {
  computePlatformFee,
  genRef,
  isBuyerVisible,
  toObjectId,
} from './marketplace.helpers';
import { serialize } from './marketplace.serializer';
import {
  AddCartItemDto,
  CheckoutDto,
  UpdateCartItemDto,
} from './dto/marketplace.dto';

type CartIssue =
  'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'OWN_LISTING' | null;

/**
 * Server-side cart + the 9-step checkout algorithm (cart_checkout.md §4.1 —
 * CANONICAL): revalidate → conditional stock decrement → ONE wallet debit per
 * checkout group (reference `MKTPAY<checkoutGroupId>`) → one order per seller
 * born PAID → compensating refund (`MKTRB<checkoutGroupId>`) on late failure.
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  private async getOrCreateCart(userId: string): Promise<CartDocument> {
    const uid = new Types.ObjectId(userId);
    const existing = await this.cartModel.findOne({ userId: uid });
    if (existing) {
      return existing;
    }
    try {
      return await this.cartModel.create({ userId: uid, items: [] });
    } catch (error: any) {
      if (error?.code === 11000) {
        const winner = await this.cartModel.findOne({ userId: uid });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  /** The caller's merchant _id string (or null) — for own-listing checks. */
  private async callerMerchantId(userId: string): Promise<string | null> {
    const merchant = await this.merchantModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('_id')
      .lean();
    return merchant ? (merchant as any)._id.toString() : null;
  }

  private lineIssue(
    product: any,
    quantity: number,
    ownMerchantId: string | null,
  ): CartIssue {
    if (!product || !isBuyerVisible(product)) {
      return 'UNAVAILABLE';
    }
    if (
      ownMerchantId &&
      product.merchantId &&
      product.merchantId.toString() === ownMerchantId
    ) {
      return 'OWN_LISTING';
    }
    const available = product.inventory?.available ?? 0;
    if (available <= 0) {
      return 'OUT_OF_STOCK';
    }
    if (available < quantity) {
      return 'INSUFFICIENT_STOCK';
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cart reads
  // ---------------------------------------------------------------------------

  /** GET /marketplace/cart — enriched + validated view (cart_checkout §3.1). */
  async getCartView(userId: string): Promise<Record<string, any>> {
    const cart = await this.getOrCreateCart(userId);
    const ownMerchantId = await this.callerMerchantId(userId);

    const productIds = cart.items.map((i) => i.productId);
    const products = productIds.length
      ? await this.productModel.find({ _id: { $in: productIds } }).lean()
      : [];
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const merchantNames = await this.marketplaceService.merchantNameMap(
      products.map((p: any) => p.merchantId).filter(Boolean),
    );

    let grandTotal = 0;
    let anyInvalid = false;
    const items = cart.items.map((line) => {
      const product = productMap.get(line.productId.toString());
      const issue = this.lineIssue(product, line.quantity, ownMerchantId);
      const price = product?.price ?? 0;
      const lineTotal = price * line.quantity;
      if (!issue) {
        grandTotal += lineTotal;
      } else {
        anyInvalid = true;
      }
      return {
        itemId: (line as any)._id?.toString(),
        product: product
          ? {
              id: product._id.toString(),
              name: product.name,
              unit: product.unit,
              price: product.price,
              image: (product.images || [])[0] || null,
              seller: this.marketplaceService.sellerView(
                serialize(product),
                merchantNames,
              ),
              stockAvailable: product.inventory?.available ?? 0,
            }
          : { id: line.productId.toString(), name: null },
        quantity: line.quantity,
        lineTotal,
        valid: !issue,
        issue,
      };
    });

    // Per-seller split preview (valid lines only).
    const groups = new Map<
      string,
      { seller: Record<string, any>; itemCount: number; subtotal: number }
    >();
    for (const item of items) {
      if (!item.valid) {
        continue;
      }
      const seller = (item.product as any).seller || {
        type: 'PLATFORM',
        displayName: this.marketplaceService.platformStoreName,
      };
      const key =
        seller.type === 'MERCHANT' ? `M:${seller.merchantId}` : 'PLATFORM';
      const group = groups.get(key) || { seller, itemCount: 0, subtotal: 0 };
      group.itemCount += 1;
      group.subtotal += item.lineTotal;
      groups.set(key, group);
    }

    const wallet = await this.walletService.getOrCreateWallet(userId);
    const available = wallet.balance?.available ?? 0;

    const empty = cart.items.length === 0;
    const checkoutBlocked = empty || anyInvalid;

    return {
      items,
      sellerGroups: Array.from(groups.values()),
      grandTotal,
      wallet: { available, sufficient: available >= grandTotal },
      checkoutBlocked,
      blockedReason: empty ? 'EMPTY_CART' : anyInvalid ? 'INVALID_ITEMS' : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Cart mutations
  // ---------------------------------------------------------------------------

  async addItem(
    userId: string,
    dto: AddCartItemDto,
  ): Promise<Record<string, any>> {
    const quantity = dto.quantity || 1;
    const maxQty = this.marketplaceService.cfg('cartMaxQtyPerItem', 999);
    const maxItems = this.marketplaceService.cfg('cartMaxItems', 30);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQty) {
      throw new MarketplaceException(
        'MKT_006',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const productId = toObjectId(dto.productId, 'MKT_001');
    const product = await this.productModel.findById(productId).lean();
    const ownMerchantId = await this.callerMerchantId(userId);

    if (!product || !isBuyerVisible(product)) {
      throw new MarketplaceException('MKT_003', HttpStatus.CONFLICT);
    }
    if (
      ownMerchantId &&
      (product as any).merchantId?.toString() === ownMerchantId
    ) {
      throw new MarketplaceException('MKT_012', HttpStatus.FORBIDDEN);
    }

    const cart = await this.getOrCreateCart(userId);
    const line = cart.items.find(
      (i) => i.productId.toString() === dto.productId,
    );
    const targetQty = (line?.quantity || 0) + quantity;
    const available = (product as any).inventory?.available ?? 0;
    if (available < targetQty) {
      throw new MarketplaceException('MKT_004', HttpStatus.CONFLICT, {
        available,
      });
    }
    if (targetQty > maxQty) {
      throw new MarketplaceException(
        'MKT_006',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (line) {
      line.quantity = targetQty;
    } else {
      if (cart.items.length >= maxItems) {
        throw new MarketplaceException('MKT_013', HttpStatus.CONFLICT, {
          maxItems,
        });
      }
      cart.items.push({
        productId,
        quantity,
        addedAt: new Date(),
      } as any);
    }
    await cart.save();
    return this.getCartView(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<Record<string, any>> {
    const maxQty = this.marketplaceService.cfg('cartMaxQtyPerItem', 999);
    if (
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1 ||
      dto.quantity > maxQty
    ) {
      throw new MarketplaceException(
        'MKT_006',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const cart = await this.getOrCreateCart(userId);
    const line = cart.items.find((i: any) => i._id?.toString() === itemId);
    if (!line) {
      throw new MarketplaceException('MKT_005', HttpStatus.NOT_FOUND);
    }
    const product = await this.productModel.findById(line.productId).lean();
    const available = (product as any)?.inventory?.available ?? 0;
    if (!product || available < dto.quantity) {
      throw new MarketplaceException('MKT_004', HttpStatus.CONFLICT, {
        available,
      });
    }
    line.quantity = dto.quantity;
    await cart.save();
    return this.getCartView(userId);
  }

  async removeItem(
    userId: string,
    itemId: string,
  ): Promise<Record<string, any>> {
    const cart = await this.getOrCreateCart(userId);
    const before = cart.items.length;
    cart.items = cart.items.filter(
      (i: any) => i._id?.toString() !== itemId,
    ) as any;
    if (cart.items.length === before) {
      throw new MarketplaceException('MKT_005', HttpStatus.NOT_FOUND);
    }
    await cart.save();
    return this.getCartView(userId);
  }

  async clearCart(userId: string): Promise<Record<string, any>> {
    const cart = await this.getOrCreateCart(userId);
    cart.items = [] as any;
    await cart.save();
    return this.getCartView(userId);
  }

  // ---------------------------------------------------------------------------
  // Checkout — the money move (cart_checkout §4.1, locked)
  // ---------------------------------------------------------------------------

  /** Restore previously-decremented stock (best-effort compensation). */
  private async restoreStock(
    decremented: { productId: Types.ObjectId; quantity: number }[],
  ): Promise<void> {
    for (const line of decremented) {
      try {
        await this.productModel.updateOne(
          { _id: line.productId },
          { $inc: { 'inventory.available': line.quantity } },
        );
      } catch (error: any) {
        this.logger.error(
          `Stock restore failed for ${line.productId}: ${error?.message}`,
        );
      }
    }
  }

  async checkout(
    userId: string,
    dto: CheckoutDto,
  ): Promise<Record<string, any>> {
    // 1. Load cart + validate address.
    const cart = await this.getOrCreateCart(userId);
    if (!cart.items.length) {
      throw new MarketplaceException('MKT_007', HttpStatus.CONFLICT);
    }
    const deliveryAddress = (dto.deliveryAddress || '').trim();
    if (deliveryAddress.length < 10 || deliveryAddress.length > 300) {
      throw new MarketplaceException(
        'MKT_008',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 2. Re-validate EVERY line — nothing mutated on failure.
    const ownMerchantId = await this.callerMerchantId(userId);
    const products = await this.productModel
      .find({ _id: { $in: cart.items.map((i) => i.productId) } })
      .lean();
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));
    const activeCategories = await this.marketplaceService.activeCategoryIds();

    const failures: { productId: string; issue: string }[] = [];
    for (const line of cart.items) {
      const product = productMap.get(line.productId.toString());
      let issue = this.lineIssue(product, line.quantity, ownMerchantId);
      if (
        !issue &&
        product &&
        !activeCategories.has((product as any).categoryId?.toString())
      ) {
        issue = 'UNAVAILABLE';
      }
      if (issue) {
        failures.push({ productId: line.productId.toString(), issue });
      }
    }
    if (failures.length) {
      throw new MarketplaceException('MKT_011', HttpStatus.CONFLICT, {
        items: failures,
      });
    }

    // 3. Group lines by seller identity.
    const feePercent = this.marketplaceService.cfg('platformFeePercent', 5);
    interface SellerGroup {
      sellerType: 'PLATFORM' | 'MERCHANT';
      merchantId?: Types.ObjectId;
      items: {
        productId: Types.ObjectId;
        productName: string;
        imageUrl: string | null;
        unit: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }[];
      subtotal: number;
    }
    const groups = new Map<string, SellerGroup>();
    for (const line of cart.items) {
      const product = productMap.get(line.productId.toString())!;
      const isMerchant =
        (product as any).source === 'MERCHANT' && (product as any).merchantId;
      const key = isMerchant
        ? `M:${(product as any).merchantId.toString()}`
        : 'PLATFORM';
      const group: SellerGroup = groups.get(key) || {
        sellerType: isMerchant ? 'MERCHANT' : 'PLATFORM',
        merchantId: isMerchant ? (product as any).merchantId : undefined,
        items: [],
        subtotal: 0,
      };
      const subtotal = (product as any).price * line.quantity;
      group.items.push({
        productId: line.productId,
        productName: (product as any).name,
        imageUrl: ((product as any).images || [])[0]?.url || null,
        unit: (product as any).unit,
        quantity: line.quantity,
        unitPrice: (product as any).price,
        subtotal,
      });
      group.subtotal += subtotal;
      groups.set(key, group);
    }
    const grandTotal = Array.from(groups.values()).reduce(
      (sum, g) => sum + g.subtotal,
      0,
    );

    // 4. References.
    const orderPrefix = this.marketplaceService.cfg('orderNumberPrefix', 'ORD');
    const checkoutPrefix = this.marketplaceService.cfg(
      'checkoutGroupPrefix',
      'CHK',
    );
    const checkoutGroupId = genRef(checkoutPrefix);
    const paymentRef = `MKTPAY${checkoutGroupId}`;

    // 5. STOCK — conditional decrement, restore-all on any miss.
    const decremented: { productId: Types.ObjectId; quantity: number }[] = [];
    for (const line of cart.items) {
      const res = await this.productModel.updateOne(
        {
          _id: line.productId,
          'inventory.available': { $gte: line.quantity },
        },
        { $inc: { 'inventory.available': -line.quantity } },
      );
      if (res.modifiedCount !== 1) {
        await this.restoreStock(decremented);
        throw new MarketplaceException('MKT_011', HttpStatus.CONFLICT, {
          items: [
            {
              productId: line.productId.toString(),
              issue: 'INSUFFICIENT_STOCK',
            },
          ],
        });
      }
      decremented.push({ productId: line.productId, quantity: line.quantity });
    }

    // 6. DEBIT — the single group debit (idempotent by reference).
    let walletView: Record<string, any> = {};
    try {
      const debit = await this.walletService.debitForPayment(userId, {
        amount: grandTotal,
        reference: paymentRef,
        category: 'PAYMENT',
        description: `Marketplace checkout ${checkoutGroupId}`,
        metadata: { checkoutGroupId },
      });
      walletView = debit.wallet || {};
    } catch (error: any) {
      await this.restoreStock(decremented);
      const payload =
        typeof error?.getResponse === 'function'
          ? error.getResponse()
          : error?.response;
      const code = payload?.error?.code || error?.code;
      if (code === 'WALLET_001') {
        const details = payload?.error?.details || ({} as Record<string, any>);
        throw new MarketplaceException('MKT_009', HttpStatus.BAD_REQUEST, {
          required: details.required ?? grandTotal,
          available: details.available ?? 0,
        });
      }
      throw new MarketplaceException('MKT_010', HttpStatus.BAD_GATEWAY);
    }

    // 7. CREATE one order per seller group + clear the cart. Compensate on
    //    failure — money is never left debited without orders.
    let created: OrderDocument[] = [];
    try {
      const docs = Array.from(groups.values()).map((group) => {
        const platformFee =
          group.sellerType === 'MERCHANT'
            ? computePlatformFee(group.subtotal, feePercent)
            : 0;
        return {
          orderNumber: genRef(orderPrefix),
          checkoutGroupId,
          buyerId: new Types.ObjectId(userId),
          seller: {
            type: group.sellerType,
            merchantId: group.merchantId || null,
          },
          items: group.items,
          pricing: {
            subtotal: group.subtotal,
            deliveryFee: 0,
            total: group.subtotal,
            platformFeePercent:
              group.sellerType === 'MERCHANT' ? feePercent : 0,
            platformFee,
            merchantNet:
              group.sellerType === 'MERCHANT'
                ? group.subtotal - platformFee
                : null,
          },
          paymentStatus: 'PAID',
          walletPaymentRef: paymentRef,
          fulfillmentStatus: 'PENDING',
          deliveryAddress,
          timeline: [
            { status: 'PENDING', at: new Date(), actorType: 'system' },
          ],
        };
      });
      created = (await this.orderModel.insertMany(
        docs,
      )) as unknown as OrderDocument[];
      cart.items = [] as any;
      await cart.save();
    } catch (error: any) {
      this.logger.error(
        `Order creation failed after debit — compensating: ${error?.message}`,
      );
      try {
        await this.walletService.creditRefund(userId, {
          amount: grandTotal,
          reference: `MKTRB${checkoutGroupId}`,
          category: 'REFUND',
          description: `Checkout rollback ${checkoutGroupId}`,
          metadata: { checkoutGroupId },
        });
      } catch (refundError: any) {
        this.logger.error(
          `CRITICAL: compensating refund failed for ${checkoutGroupId}: ${refundError?.message}`,
        );
      }
      await this.restoreStock(decremented);
      throw new MarketplaceException('MKT_010', HttpStatus.BAD_GATEWAY);
    }

    // 8. NOTIFY — best-effort, never blocks the money path.
    this.notifyCheckout(userId, checkoutGroupId, created, grandTotal).catch(
      (error: any) =>
        this.logger.warn(`Checkout notifications failed: ${error?.message}`),
    );

    // 9. Return the checkout group.
    const merchantNames = await this.marketplaceService.merchantNameMap(
      created.map((o) => o.seller?.merchantId).filter(Boolean) as any[],
    );
    return {
      checkoutGroupId,
      walletPaymentRef: paymentRef,
      grandTotal,
      wallet: walletView,
      orders: created.map((o) => {
        const plain = serialize<any>(o);
        return {
          id: plain.id,
          orderNumber: plain.orderNumber,
          seller: {
            type: plain.seller?.type,
            ...(plain.seller?.merchantId
              ? {
                  merchantId: plain.seller.merchantId,
                  displayName:
                    merchantNames.get(plain.seller.merchantId.toString()) ||
                    'Merchant',
                }
              : {
                  displayName: this.marketplaceService.platformStoreName,
                }),
          },
          totalAmount: plain.pricing?.total,
          status: plain.fulfillmentStatus,
          fulfillmentStatus: plain.fulfillmentStatus,
          paymentStatus: plain.paymentStatus,
          items: plain.items,
        };
      }),
    };
  }

  private async notifyCheckout(
    userId: string,
    checkoutGroupId: string,
    orders: OrderDocument[],
    grandTotal: number,
  ): Promise<void> {
    const merchantIds = orders
      .filter((o) => o.seller?.type === 'MERCHANT' && o.seller.merchantId)
      .map((o) => o.seller.merchantId!.toString());
    const merchants = merchantIds.length
      ? await this.merchantModel
          .find({ _id: { $in: merchantIds } })
          .select('userId businessName')
          .lean()
      : [];
    const merchantUserMap = new Map(
      merchants.map((m: any) => [m._id.toString(), m]),
    );

    for (const order of orders) {
      const orderId = (order._id as Types.ObjectId).toString();
      // Seller merchant (MERCHANT orders).
      if (order.seller?.type === 'MERCHANT' && order.seller.merchantId) {
        const merchant = merchantUserMap.get(
          order.seller.merchantId.toString(),
        );
        if (merchant?.userId) {
          await this.notificationService.notify({
            recipientType: 'user',
            recipientId: merchant.userId,
            event: MKT_EVENTS.ORDER_PLACED,
            type: 'info',
            title: 'New order received',
            body: `Order ${order.orderNumber} — ₦${order.pricing.total.toLocaleString()} (${order.items.length} item${order.items.length === 1 ? '' : 's'}).`,
            data: {
              orderId,
              orderNumber: order.orderNumber,
              link: `/app/merchant?tab=orders`,
            },
          });
        }
      }
      // ALL admins — per split order.
      await this.notificationService.notifyAdmins({
        event: MKT_EVENTS.ORDER_PLACED,
        type: 'info',
        title: 'New marketplace order',
        body: `Order ${order.orderNumber} (${order.seller?.type}) — ₦${order.pricing.total.toLocaleString()}.`,
        data: {
          orderId,
          orderNumber: order.orderNumber,
          link: `/bennie/orders/${orderId}`,
        },
      });
    }

    // Buyer receipt (whole group).
    await this.notificationService.notify({
      recipientType: 'user',
      recipientId: userId,
      event: MKT_EVENTS.CHECKOUT_SUCCESS,
      type: 'success',
      title: 'Payment successful',
      body: `₦${grandTotal.toLocaleString()} paid — ${orders.length} order${orders.length === 1 ? '' : 's'} placed.`,
      data: {
        checkoutGroupId,
        link: `/app/marketplace/orders`,
      },
    });
  }
}
