import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { UsersModule } from '../users/users.module';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { MustChangePasswordGuard } from './guards/must-change-password.guard';
import { AdminPermissionsService } from './admin-permissions.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSeederService } from './admin-seeder.service';
import { AdminUser, AdminUserSchema } from './schemas/admin-user.schema';
import { AdminRole, AdminRoleSchema } from './schemas/admin-role.schema';
import {
  AdminRefreshToken,
  AdminRefreshTokenSchema,
} from './schemas/admin-refresh-token.schema';
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from './schemas/admin-audit-log.schema';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UsersModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: AdminRole.name, schema: AdminRoleSchema },
      { name: AdminRefreshToken.name, schema: AdminRefreshTokenSchema },
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
    ]),
  ],
  controllers: [AdminAuthController, AdminDashboardController],
  providers: [
    AdminAuthService,
    AdminDashboardService,
    AdminJwtStrategy,
    AdminJwtGuard,
    PermissionsGuard,
    MustChangePasswordGuard,
    AdminPermissionsService,
    AdminAuditService,
    AdminSeederService,
  ],
  exports: [
    AdminJwtGuard,
    PermissionsGuard,
    MustChangePasswordGuard,
    AdminPermissionsService,
    AdminAuditService,
    MongooseModule,
  ],
})
export class AdminModule {}
