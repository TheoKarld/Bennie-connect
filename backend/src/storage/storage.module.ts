import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { FileEntity, FileSchema } from './schemas/file.schema';
import { GcsService } from './gcs.service';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { AdminUploadController } from './admin-upload.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    // AuthModule provides the JwtStrategy (+ exports JwtAuthGuard) the controller
    // guard needs.
    AuthModule,
    // AdminModule provides the admin guards (AdminJwtGuard, MustChangePasswordGuard)
    // that AdminUploadController depends on.
    AdminModule,
    MongooseModule.forFeature([{ name: FileEntity.name, schema: FileSchema }]),
  ],
  controllers: [UploadController, AdminUploadController],
  providers: [GcsService, UploadService],
  // Exported so other modules can reuse GCS uploads (e.g. profile images).
  exports: [UploadService, GcsService],
})
export class StorageModule {}
