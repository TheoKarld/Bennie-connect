import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { MarketplaceService } from './marketplace.service';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import {
  AddCartItemDto,
  BrowseProductsDto,
  CancelOrderDto,
  CheckoutDto,
  ListMyOrdersDto,
  UpdateCartItemDto,
} from './dto/marketplace.dto';

/**
 * User-plane storefront + cart + checkout + orders.
 * Base `/api/v1/marketplace`, user JWT.
 */
@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
  ) {}

  private uid(user: UserDocument): string {
    return user._id.toString();
  }

  // --- Storefront -----------------------------------------------------------

  @Get('categories')
  @ApiOperation({ summary: 'Active categories with visible product counts' })
  async categories() {
    const data = await this.marketplaceService.listCategories();
    return { success: true, data };
  }

  @Get('products')
  @ApiOperation({ summary: 'Browse/search/filter/sort the visible catalogue' })
  async products(@Query() query: BrowseProductsDto) {
    const data = await this.marketplaceService.browseProducts(query);
    return { success: true, data };
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Product detail (gallery, video, seller, inCart)' })
  async productDetail(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.marketplaceService.productDetail(
      id,
      this.uid(user),
    );
    return { success: true, data };
  }

  // --- Cart -------------------------------------------------------------------

  @Get('cart')
  @ApiOperation({ summary: "The caller's cart, enriched + validated" })
  async cart(@CurrentUser() user: UserDocument) {
    const data = await this.cartService.getCartView(this.uid(user));
    return { success: true, data };
  }

  @Post('cart/items')
  @ApiOperation({ summary: 'Add a product (or increment its line)' })
  async addCartItem(
    @CurrentUser() user: UserDocument,
    @Body() dto: AddCartItemDto,
  ) {
    const data = await this.cartService.addItem(this.uid(user), dto);
    return { success: true, data };
  }

  @Patch('cart/items/:itemId')
  @ApiOperation({ summary: "Set a line's absolute quantity" })
  async updateCartItem(
    @CurrentUser() user: UserDocument,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const data = await this.cartService.updateItem(this.uid(user), itemId, dto);
    return { success: true, data };
  }

  @Delete('cart/items/:itemId')
  @ApiOperation({ summary: 'Remove a cart line' })
  async removeCartItem(
    @CurrentUser() user: UserDocument,
    @Param('itemId') itemId: string,
  ) {
    const data = await this.cartService.removeItem(this.uid(user), itemId);
    return { success: true, data };
  }

  @Delete('cart')
  @ApiOperation({ summary: 'Empty the cart' })
  async clearCart(@CurrentUser() user: UserDocument) {
    const data = await this.cartService.clearCart(this.uid(user));
    return { success: true, data };
  }

  // --- Checkout ---------------------------------------------------------------

  @Post('checkout')
  @ApiOperation({
    summary:
      'Split the cart into one order per seller + ONE wallet debit (MKTPAY<checkoutGroupId>)',
  })
  async checkout(@CurrentUser() user: UserDocument, @Body() dto: CheckoutDto) {
    const data = await this.cartService.checkout(this.uid(user), dto);
    return {
      success: true,
      message: `Payment successful. ${data.orders.length} order${data.orders.length === 1 ? '' : 's'} placed.`,
      data,
    };
  }

  // --- Orders -------------------------------------------------------------------

  @Get('orders')
  @ApiOperation({
    summary: "The caller's purchases, grouped by checkoutGroupId",
  })
  async myOrders(
    @CurrentUser() user: UserDocument,
    @Query() query: ListMyOrdersDto,
  ) {
    const data = await this.ordersService.listMyOrders(this.uid(user), query);
    return { success: true, data };
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'One order (timeline, items, refs, siblings)' })
  async orderDetail(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.ordersService.myOrderDetail(this.uid(user), id);
    return { success: true, data };
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel while PENDING → auto wallet refund' })
  async cancelOrder(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const data = await this.ordersService.cancelMyOrder(
      this.uid(user),
      id,
      dto,
    );
    return { success: true, data };
  }

  @Post('orders/:id/confirm-received')
  @ApiOperation({
    summary: 'Buyer confirms receipt after DELIVERED (idempotent)',
  })
  async confirmReceived(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.ordersService.confirmReceived(this.uid(user), id);
    return { success: true, data };
  }
}
