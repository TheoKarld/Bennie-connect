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
import { MerchantService } from './merchant.service';
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
 * Merchant Hub — user JWT, gated internally on the caller's merchant status.
 * Base `/api/v1/merchant` (merchant_panel.md §3).
 */
@ApiTags('merchant')
@ApiBearerAuth()
@Controller('merchant')
@UseGuards(JwtAuthGuard)
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  private uid(user: UserDocument): string {
    return user._id.toString();
  }

  @Get('me')
  @ApiOperation({
    summary: 'Lifecycle status + profile + earnings summary (never 404s)',
  })
  async me(@CurrentUser() user: UserDocument) {
    const data = await this.merchantService.me(this.uid(user));
    return { success: true, data };
  }

  @Post('kyc')
  @ApiOperation({ summary: 'Save/submit (and resubmit) the KYC application' })
  async saveKyc(
    @CurrentUser() user: UserDocument,
    @Body() dto: MerchantKycDto,
  ) {
    const data = await this.merchantService.saveKyc(this.uid(user), dto);
    return { success: true, data };
  }

  @Get('kyc/documents/:fileId/url')
  @ApiOperation({ summary: 'Short-lived signed URL for an OWN KYC document' })
  async kycDocumentUrl(
    @CurrentUser() user: UserDocument,
    @Param('fileId') fileId: string,
  ) {
    const data = await this.merchantService.kycDocumentUrl(
      this.uid(user),
      fileId,
    );
    return { success: true, data };
  }

  // --- Products (APPROVED only) ---------------------------------------------

  @Get('products')
  @ApiOperation({ summary: "The merchant's listings (all moderation states)" })
  async listProducts(
    @CurrentUser() user: UserDocument,
    @Query() query: ListMerchantProductsDto,
  ) {
    const data = await this.merchantService.listProducts(this.uid(user), query);
    return { success: true, data };
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a listing → moderationStatus PENDING' })
  async createProduct(
    @CurrentUser() user: UserDocument,
    @Body() dto: MerchantProductCreateDto,
  ) {
    const data = await this.merchantService.createProduct(this.uid(user), dto);
    return { success: true, data };
  }

  @Patch('products/:id')
  @ApiOperation({
    summary: 'Edit a listing (content edits re-enter moderation)',
  })
  async updateProduct(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: MerchantProductUpdateDto,
  ) {
    const data = await this.merchantService.updateProduct(
      this.uid(user),
      id,
      dto,
    );
    return { success: true, data };
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft-delete a listing' })
  async deleteProduct(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.merchantService.deleteProduct(this.uid(user), id);
    return { success: true, data };
  }

  // --- Orders (readable + advanceable while SUSPENDED) -----------------------

  @Get('orders')
  @ApiOperation({ summary: "Orders received on the merchant's listings" })
  async listOrders(
    @CurrentUser() user: UserDocument,
    @Query() query: ListMerchantOrdersDto,
  ) {
    const data = await this.merchantService.listOrders(this.uid(user), query);
    return { success: true, data };
  }

  @Patch('orders/:id/fulfillment')
  @ApiOperation({
    summary:
      'Advance own order exactly one step forward (DELIVERED books earnings once)',
  })
  async advanceFulfillment(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: MerchantFulfillmentDto,
  ) {
    const data = await this.merchantService.advanceFulfillment(
      this.uid(user),
      id,
      dto,
    );
    return { success: true, data };
  }

  // --- Earnings & payouts ------------------------------------------------------

  @Get('earnings')
  @ApiOperation({ summary: 'Earnings ledger + available balance' })
  async earnings(
    @CurrentUser() user: UserDocument,
    @Query() query: ListEarningsDto,
  ) {
    const data = await this.merchantService.earnings(this.uid(user), query);
    return { success: true, data };
  }

  @Get('payout-requests')
  @ApiOperation({ summary: 'Payout history' })
  async listPayoutRequests(@CurrentUser() user: UserDocument) {
    const data = await this.merchantService.listPayoutRequests(this.uid(user));
    return { success: true, data };
  }

  @Post('payout-requests')
  @ApiOperation({
    summary: 'Request a payout (holds the amount, locks entries)',
  })
  async createPayoutRequest(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreatePayoutRequestDto,
  ) {
    const data = await this.merchantService.createPayoutRequest(
      this.uid(user),
      dto,
    );
    return { success: true, data };
  }

  @Post('payout-requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel own payout while REQUESTED' })
  async cancelPayoutRequest(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.merchantService.cancelPayoutRequest(
      this.uid(user),
      id,
    );
    return { success: true, data };
  }

  @Post('payout-requests/:id/confirm-received')
  @ApiOperation({ summary: 'Confirm the wired payout (settles entries)' })
  async confirmPayoutReceived(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.merchantService.confirmPayoutReceived(
      this.uid(user),
      id,
    );
    return { success: true, data };
  }
}
