import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationModule } from '../notifications/notification.module';
import { Equipment, EquipmentSchema } from './schemas/equipment.schema';
import {
  EquipmentBooking,
  EquipmentBookingSchema,
} from './schemas/equipment-booking.schema';
import {
  EquipmentRateConfig,
  EquipmentRateConfigSchema,
} from './schemas/equipment-rate-config.schema';
import { Geofence, GeofenceSchema } from './schemas/geofence.schema';
import { GpsAlert, GpsAlertSchema } from './schemas/gps-alert.schema';
import { EquipmentService } from './equipment.service';
import { AdminEquipmentService } from './admin-equipment.service';
import { EquipmentGpsService } from './equipment-gps.service';
import { EquipmentGateway } from './equipment.gateway';
import { EquipmentController } from './equipment.controller';
import { AdminEquipmentController } from './admin-equipment.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    // JwtModule (empty registration) — the gateway passes secrets per-call in
    // verifyAsync, mirroring NotificationModule/ContributionsModule.
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
      { name: EquipmentBooking.name, schema: EquipmentBookingSchema },
      { name: EquipmentRateConfig.name, schema: EquipmentRateConfigSchema },
      { name: Geofence.name, schema: GeofenceSchema },
      { name: GpsAlert.name, schema: GpsAlertSchema },
    ]),
    UsersModule,
    // WalletModule exports WalletService (debitForPayment / creditRefund).
    WalletModule,
    // NotificationModule exports NotificationService (notify / notifyAdmins).
    NotificationModule,
    // AdminModule provides the admin guards + AdminAuditService +
    // AdminPermissionsService for the admin controller.
    AdminModule,
  ],
  controllers: [EquipmentController, AdminEquipmentController],
  providers: [
    EquipmentService,
    AdminEquipmentService,
    EquipmentGpsService,
    EquipmentGateway,
  ],
  exports: [EquipmentService],
})
export class EquipmentModule {}
