import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminUserDocument } from './schemas/admin-user.schema';
import { AdminRole, AdminRoleDocument } from './schemas/admin-role.schema';
import {
  SEED_SUPER_ADMIN_EMAIL,
  SEED_SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_ROLE_NAME,
} from './admin.constants';

/**
 * Idempotently seeds the Super Admin role and (if no admins exist) the
 * bootstrap super-admin account. Runs on module init. Never logs the password.
 */
@Injectable()
export class AdminSeederService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    @InjectModel(AdminRole.name)
    private readonly adminRoleModel: Model<AdminRoleDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch (error: any) {
      this.logger.error(`Admin seeding failed: ${error?.message}`);
    }
  }

  private async seed(): Promise<void> {
    // 1. Super Admin role.
    let superRole = await this.adminRoleModel.findOne({
      name: SUPER_ADMIN_ROLE_NAME,
    });
    if (!superRole) {
      superRole = await this.adminRoleModel.create({
        name: SUPER_ADMIN_ROLE_NAME,
        description: 'Full unrestricted access',
        permissions: ['*'],
        isSystem: true,
      });
      this.logger.log(`Seeded "${SUPER_ADMIN_ROLE_NAME}" role.`);
    } else {
      this.logger.log(`"${SUPER_ADMIN_ROLE_NAME}" role already exists.`);
    }

    // 2. Bootstrap super admin (only when no admin exists at all).
    const adminCount = await this.adminUserModel.estimatedDocumentCount();
    if (adminCount > 0) {
      this.logger.log(
        'Admin accounts already present — skipping super-admin seed.',
      );
      return;
    }

    const saltRounds =
      this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
    const hashedPassword = await bcrypt.hash(
      SEED_SUPER_ADMIN_PASSWORD,
      saltRounds,
    );

    await this.adminUserModel.create({
      email: SEED_SUPER_ADMIN_EMAIL,
      firstName: 'Super',
      lastName: 'Admin',
      password: hashedPassword,
      roleId: superRole._id,
      isSuperAdmin: true,
      isActive: true,
      mustChangePassword: true,
    });

    this.logger.log(
      `Seeded bootstrap super admin (${SEED_SUPER_ADMIN_EMAIL}). ` +
        'mustChangePassword=true — rotate on first login.',
    );
  }
}
