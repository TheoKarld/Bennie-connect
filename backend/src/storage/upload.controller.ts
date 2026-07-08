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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { UploadService } from './upload.service';
import { ListMediaDto } from './dto';
import { UPLOAD_ERRORS } from './storage.constants';
import { MulterExceptionFilter } from './multer-exception.filter';
import { MAX_UPLOAD_BYTES, uploadFileFilter } from './upload.multer';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file to storage' })
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: uploadFileFilter,
    }),
  )
  async upload(
    @CurrentUser() user: UserDocument,
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
      { type: 'user', id: user._id as never },
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
      'Short-lived V4 signed URL for an OWN private file (owner-scoped); public files return their plain URL',
  })
  async signedUrl(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.uploadService.signedUrl(id, {
      ownerUserId: user._id as never,
    });
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an uploaded file by its record id' })
  async remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.uploadService.remove(id, user._id as never);
    return { success: true, data };
  }
}
