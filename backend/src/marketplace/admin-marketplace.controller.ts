import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { RequirePermissions } from '../admin/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminMarketplaceService } from './admin-marketplace.service';
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
 * Admin marketplace console — products, categories, moderation, inventory,
 * seller oversight. Base `/api/v1/admin/marketplace`. Every mutation writes
 * an adminAuditLog entry (PRD/admin_module/marketplace/marketplace.md §6.2).
 */
@ApiTags('admin-marketplace')
@ApiBearerAuth()
@Controller('admin/marketplace')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminMarketplaceController {
  constructor(
    private readonly service: AdminMarketplaceService,
    private readonly audit: AdminAuditService,
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  // ===========================================================================
  // Categories (declared before products/:id shapes for clarity)
  // ===========================================================================

  @Get('categories')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'List categories (incl. inactive, with counts)' })
  async listCategories() {
    const data = await this.service.listCategories();
    return { success: true, data };
  }

  @Post('categories')
  @RequirePermissions('marketplace:configure')
  @ApiOperation({ summary: 'Create a category' })
  async createCategory(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: CategoryCreateDto,
    @Req() req: Request,
  ) {
    const data = await this.service.createCategory(dto, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.category.create',
      permission: 'marketplace:configure',
      resource: 'marketplace',
      targetId: data.id,
      after: data,
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Patch('categories/:id')
  @RequirePermissions('marketplace:configure')
  @ApiOperation({ summary: 'Edit / toggle active / reorder a category' })
  async updateCategory(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: CategoryUpdateDto,
    @Req() req: Request,
  ) {
    const { before, after } = await this.service.updateCategory(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.category.update',
      permission: 'marketplace:configure',
      resource: 'marketplace',
      targetId: id,
      before,
      after,
      ...this.meta(req),
    });
    return { success: true, data: after };
  }

  @Delete('categories/:id')
  @RequirePermissions('marketplace:configure')
  @ApiOperation({ summary: 'Delete a category (blocked while referenced)' })
  async deleteCategory(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const data = await this.service.deleteCategory(id);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.category.delete',
      permission: 'marketplace:configure',
      resource: 'marketplace',
      targetId: id,
      ...this.meta(req),
    });
    return { success: true, data };
  }

  // ===========================================================================
  // Moderation queue + inventory + sellers (before products/:id)
  // ===========================================================================

  @Get('moderation-queue')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'PENDING listings, oldest first' })
  async moderationQueue(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.service.moderationQueue(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, data };
  }

  @Get('inventory/low-stock')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'Products at/below their low-stock threshold' })
  async lowStock() {
    const data = await this.service.lowStock();
    return { success: true, data };
  }

  @Get('sellers')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'Merchants with listing/order/GMV aggregates' })
  async listSellers(@Query() query: ListSellersDto) {
    const data = await this.service.listSellers(query);
    return { success: true, data };
  }

  @Get('sellers/:merchantId')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'Merchant summary + listings + recent orders' })
  async sellerDetail(@Param('merchantId') merchantId: string) {
    const data = await this.service.sellerDetail(merchantId);
    return { success: true, data };
  }

  // ===========================================================================
  // Products
  // ===========================================================================

  @Get('products')
  @RequirePermissions('marketplace:view')
  @ApiOperation({ summary: 'List/search products (faceted filters)' })
  async listProducts(@Query() query: ListProductsAdminDto) {
    const data = await this.service.listProducts(query);
    return { success: true, data };
  }

  @Get('products/:id')
  @RequirePermissions('marketplace:view')
  @ApiOperation({
    summary: 'Product detail + moderation history + merchant summary',
  })
  async productDetail(@Param('id') id: string) {
    const data = await this.service.productDetail(id);
    return { success: true, data };
  }

  @Post('products')
  @RequirePermissions('marketplace:create')
  @ApiOperation({
    summary:
      'Admin-create a platform product (source ADMIN, APPROVED — skips moderation)',
  })
  async createProduct(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: AdminProductCreateDto,
    @Req() req: Request,
  ) {
    const data = await this.service.createProduct(dto, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.product.create',
      permission: 'marketplace:create',
      resource: 'marketplace',
      targetId: data.id,
      after: { source: 'ADMIN', name: data.name, price: data.price },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Patch('products/:id')
  @RequirePermissions('marketplace:update')
  @ApiOperation({ summary: 'Edit product fields (media replace cascades)' })
  async updateProduct(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminProductUpdateDto,
    @Req() req: Request,
  ) {
    const { before, after } = await this.service.updateProduct(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.product.update',
      permission: 'marketplace:update',
      resource: 'marketplace',
      targetId: id,
      before,
      after,
      ...this.meta(req),
    });
    return { success: true, data: after };
  }

  @Delete('products/:id')
  @RequirePermissions('marketplace:delete')
  @ApiOperation({
    summary:
      'Hard-delete a product + cascade media (Super-Admin-only via *:delete); blocked while non-terminal orders contain it',
  })
  async deleteProduct(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const data = await this.service.deleteProduct(id);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.product.delete',
      permission: 'marketplace:delete',
      resource: 'marketplace',
      targetId: id,
      after: { cascadedMedia: data.cascadedMedia },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post('products/:id/approve')
  @RequirePermissions('marketplace:approve')
  @ApiOperation({ summary: 'Approve a PENDING/CHANGES_REQUESTED listing' })
  async approveProduct(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const data = await this.service.approveProduct(id, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.product.approve',
      permission: 'marketplace:approve',
      resource: 'marketplace',
      targetId: id,
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post('products/:id/reject')
  @RequirePermissions('marketplace:reject')
  @ApiOperation({
    summary: 'Reject a listing or request changes (reason required)',
  })
  async rejectProduct(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @Req() req: Request,
  ) {
    const data = await this.service.rejectProduct(
      id,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: dto.requestChanges
        ? 'marketplace.product.request_changes'
        : 'marketplace.product.reject',
      permission: 'marketplace:reject',
      resource: 'marketplace',
      targetId: id,
      after: { reason: dto.reason },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Patch('products/:id/inventory')
  @RequirePermissions('marketplace:update')
  @ApiOperation({ summary: 'Adjust available / lowStockThreshold' })
  async patchInventory(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: InventoryPatchDto,
    @Req() req: Request,
  ) {
    const { before, after } = await this.service.patchInventory(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'marketplace.product.update',
      permission: 'marketplace:update',
      resource: 'marketplace',
      targetId: id,
      before,
      after,
      ...this.meta(req),
    });
    return { success: true, data: after };
  }
}
