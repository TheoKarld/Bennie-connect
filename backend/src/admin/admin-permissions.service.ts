import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminUserDocument } from './schemas/admin-user.schema';
import { AdminRole, AdminRoleDocument } from './schemas/admin-role.schema';
import { resolveEffectivePermissions } from './permissions.util';

@Injectable()
export class AdminPermissionsService {
  constructor(
    @InjectModel(AdminRole.name)
    private readonly adminRoleModel: Model<AdminRoleDocument>,
  ) {}

  /**
   * Loads the admin's role and returns the resolved effective permission set:
   * (role.permissions ∪ overrides.granted) \ overrides.revoked. A super-admin
   * short-circuits to `['*']`.
   */
  async getEffectivePermissions(admin: AdminUserDocument): Promise<string[]> {
    if (admin.isSuperAdmin) {
      return ['*'];
    }
    const role = await this.adminRoleModel
      .findById(admin.roleId)
      .lean()
      .catch(() => null);
    const rolePermissions = role?.permissions ?? [];
    const overrides = admin.permissionOverrides ?? {
      granted: [],
      revoked: [],
    };
    return resolveEffectivePermissions(
      rolePermissions,
      overrides.granted ?? [],
      overrides.revoked ?? [],
    );
  }

  /** Loads the admin's role document (or null). */
  async getRole(admin: AdminUserDocument): Promise<AdminRoleDocument | null> {
    return this.adminRoleModel.findById(admin.roleId).catch(() => null);
  }
}
