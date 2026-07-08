import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationModule } from '../notifications/notification.module';
import { StorageModule } from '../storage/storage.module';
import {
  ProductCategory,
  ProductCategorySchema,
} from './schemas/product-category.schema';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  ProductModeration,
  ProductModerationSchema,
} from './schemas/product-moderation.schema';
import { Cart, CartSchema } from './schemas/cart.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Merchant, MerchantSchema } from './schemas/merchant.schema';
import {
  MerchantEarning,
  MerchantEarningSchema,
} from './schemas/merchant-earning.schema';
import {
  MerchantPayoutRequest,
  MerchantPayoutRequestSchema,
} from './schemas/merchant-payout-request.schema';
import { PremblyService } from './prembly.service';
import { MarketplaceService } from './marketplace.service';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { MerchantService } from './merchant.service';
import { AdminMarketplaceService } from './admin-marketplace.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminMerchantsService } from './admin-merchants.service';
import { MarketplaceController } from './marketplace.controller';
import { MerchantController } from './merchant.controller';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminMerchantsController } from './admin-merchants.controller';

/**
 * LIVE Marketplace + Orders + Merchants (PRD set: ecommerce-marketplace,
 * cart_checkout, merchant_panel + admin marketplace/orders/merchants).
 * Wallet-only checkout (one debit per checkout group), split-per-seller
 * orders, per-listing moderation, Prembly-advisory merchant KYC with
 * private-bucket docs, earnings ledger + manual adashe-style payouts.
 */
@Module({
  imports: [
    ConfigModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: ProductCategory.name, schema: ProductCategorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: ProductModeration.name, schema: ProductModerationSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Merchant.name, schema: MerchantSchema },
      { name: MerchantEarning.name, schema: MerchantEarningSchema },
      { name: MerchantPayoutRequest.name, schema: MerchantPayoutRequestSchema },
    ]),
    UsersModule,
    // WalletModule exports WalletService (debitForPayment / creditRefund).
    WalletModule,
    // NotificationModule exports NotificationService (notify / notifyAdmins).
    NotificationModule,
    // StorageModule exports UploadService (media validation, signed URLs,
    // KYC-doc purge + product-media cascade removal).
    StorageModule,
    // AdminModule provides the admin guards + AdminAuditService for the
    // admin controllers.
    AdminModule,
  ],
  controllers: [
    MarketplaceController,
    MerchantController,
    AdminMarketplaceController,
    AdminOrdersController,
    AdminMerchantsController,
  ],
  providers: [
    PremblyService,
    MarketplaceService,
    CartService,
    OrdersService,
    MerchantService,
    AdminMarketplaceService,
    AdminOrdersService,
    AdminMerchantsService,
  ],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
