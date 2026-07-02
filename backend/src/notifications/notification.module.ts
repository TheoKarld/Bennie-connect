import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AdminModule } from '../admin/admin.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { FcmService } from './fcm.service';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from './admin-notification.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    // JwtModule (empty registration) — secrets are passed per-call in the
    // gateway's verifyAsync, mirroring how AdminModule verifies tokens.
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
    // AdminModule re-exports MongooseModule with the AdminUser model registered
    // and provides the admin guards used by AdminNotificationController.
    AdminModule,
  ],
  controllers: [NotificationController, AdminNotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    FcmService,
    JwtAuthGuard,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
