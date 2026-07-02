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
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { NotificationService } from './notification.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@ApiTags('admin-notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard)
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private recipient(admin: AdminUserDocument) {
    return {
      recipientType: 'admin' as const,
      recipientId: admin._id.toString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List the current admin notifications (paginated)' })
  async list(
    @CurrentAdmin() admin: AdminUserDocument,
    @Query() query: ListNotificationsDto,
  ) {
    const result = await this.notificationService.list('admin', admin._id, {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly === 'true',
    });
    return { success: true, data: result };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the current admin' })
  async unreadCount(@CurrentAdmin() admin: AdminUserDocument) {
    const count = await this.notificationService.unreadCount(
      'admin',
      admin._id,
    );
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.notificationService.markRead(
      id,
      this.recipient(admin),
    );
    return { success: true, data };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentAdmin() admin: AdminUserDocument) {
    const data = await this.notificationService.markAllRead(
      this.recipient(admin),
    );
    return { success: true, data };
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register an FCM web-push device token' })
  async registerDeviceToken(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const doc = await this.notificationService.registerDeviceToken(
      this.recipient(admin),
      dto.token,
      dto.userAgent,
    );
    return { success: true, data: { id: doc._id.toString() } };
  }

  @Delete('device-tokens/:token')
  @ApiOperation({ summary: 'Remove an FCM web-push device token' })
  async removeDeviceToken(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('token') token: string,
  ) {
    const data = await this.notificationService.removeDeviceToken(
      this.recipient(admin),
      token,
    );
    return { success: true, data };
  }
}
