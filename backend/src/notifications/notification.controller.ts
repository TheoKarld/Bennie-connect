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
import { NotificationService } from './notification.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private recipient(user: UserDocument) {
    return { recipientType: 'user' as const, recipientId: user._id.toString() };
  }

  @Get()
  @ApiOperation({ summary: 'List the current user notifications (paginated)' })
  async list(
    @CurrentUser() user: UserDocument,
    @Query() query: ListNotificationsDto,
  ) {
    const result = await this.notificationService.list('user', user._id, {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly === 'true',
    });
    return { success: true, data: result };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the current user' })
  async unreadCount(@CurrentUser() user: UserDocument) {
    const count = await this.notificationService.unreadCount('user', user._id);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.notificationService.markRead(
      id,
      this.recipient(user),
    );
    return { success: true, data };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: UserDocument) {
    const data = await this.notificationService.markAllRead(
      this.recipient(user),
    );
    return { success: true, data };
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register an FCM web-push device token' })
  async registerDeviceToken(
    @CurrentUser() user: UserDocument,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const doc = await this.notificationService.registerDeviceToken(
      this.recipient(user),
      dto.token,
      dto.userAgent,
    );
    return { success: true, data: { id: doc._id.toString() } };
  }

  @Delete('device-tokens/:token')
  @ApiOperation({ summary: 'Remove an FCM web-push device token' })
  async removeDeviceToken(
    @CurrentUser() user: UserDocument,
    @Param('token') token: string,
  ) {
    const data = await this.notificationService.removeDeviceToken(
      this.recipient(user),
      token,
    );
    return { success: true, data };
  }
}
