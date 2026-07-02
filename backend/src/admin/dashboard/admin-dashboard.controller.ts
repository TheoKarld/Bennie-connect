import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { MustChangePasswordGuard } from '../guards/must-change-password.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * Live dashboard aggregates plus readiness flags for not-yet-live domains.
   * Read-only — deliberately NOT audited (avoids polling noise), per the
   * dashboard PRD.
   */
  @Get('overview')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Admin dashboard overview aggregates' })
  async overview() {
    return {
      success: true,
      data: await this.dashboardService.getOverview(),
    };
  }
}
