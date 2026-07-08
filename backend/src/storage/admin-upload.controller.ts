import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { UploadService } from './upload.service';
import { ListMediaDto } from './dto';
import { UPLOAD_ERRORS } from './storage.constants';
import { MulterExceptionFilter } from './multer-exception.filter';
import { MAX_UPLOAD_BYTES, uploadFileFilter } from './upload.multer';

/**
 * Admin-plane upload endpoint. Any authenticated admin (AdminJwtGuard +
 * MustChangePasswordGuard, no per-permission gate) can upload/list/delete —
 * mirroring the user side. The media library is the whole bucket index (both
 * planes list all files); ownership is recorded via `uploaderType: 'admin'`.
 */
@ApiTags('admin-upload')
@ApiBearerAuth()
@Controller('admin/upload')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard)
export class AdminUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file to storage (admin plane)' })
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: uploadFileFilter,
    }),
  )
  async upload(
    @CurrentAdmin() admin: AdminUserDocument,
    @UploadedFile() file: Express.Multer.File,
    @Query('visibility') visibilityQuery?: string,
    @Query('folder') folder?: string,
    @Body('visibility') visibilityField?: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: UPLOAD_ERRORS.INVALID_TYPE,
        message: 'No file provided under field "file"',
      });
    }
    const visibility =
      (visibilityQuery || visibilityField) === 'private'
        ? ('private' as const)
        : ('public' as const);
    const data = await this.uploadService.upload(
      file,
      { type: 'admin', id: admin._id },
      { visibility, folder },
    );
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List uploaded files (media library, paginated)' })
  async mediaLibrary(@Query() query: ListMediaDto) {
    const data = await this.uploadService.mediaLibrary(query);
    return { success: true, data };
  }

  @Get(':id/signed-url')
  @ApiOperation({
    summary:
      'Short-lived V4 signed URL for a private file (any active admin); public files return their plain URL',
  })
  async signedUrl(@Param('id') id: string) {
    const data = await this.uploadService.signedUrl(id);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an uploaded file by its record id' })
  async remove(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.uploadService.remove(id, admin._id as never);
    return { success: true, data };
  }
}
