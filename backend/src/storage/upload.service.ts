import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FileDocument, FileEntity } from './schemas/file.schema';
import { GcsService, ObjectVisibility } from './gcs.service';
import { UPLOAD_ERRORS } from './storage.constants';
import { ListMediaDto } from './dto';

export type UploaderType = 'user' | 'admin';

export interface Uploader {
  type: UploaderType;
  id: string | Types.ObjectId;
}

export interface UploadOptions {
  visibility?: ObjectVisibility;
  folder?: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  size: number;
  url: string;
  bucket: string;
  path: string;
  uploaderType: UploaderType;
  uploaderId: string;
  visibility: ObjectVisibility;
  createdAt: Date;
}

export interface SignedUrlResult {
  id: string;
  signed: boolean;
  url: string;
  expiresAt: Date | null;
}

export interface MediaLibraryResult {
  items: FileMetadata[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectModel(FileEntity.name)
    private readonly fileModel: Model<FileDocument>,
    private readonly gcs: GcsService,
  ) {}

  private toMetadata(doc: FileDocument): FileMetadata {
    return {
      id: (doc._id as Types.ObjectId).toString(),
      name: doc.name,
      originalName: doc.originalName,
      fileType: doc.fileType,
      size: doc.size,
      url: doc.url,
      bucket: doc.bucket,
      path: doc.path,
      uploaderType: doc.uploaderType ?? 'user',
      uploaderId: doc.uploaderId?.toString(),
      visibility: doc.visibility ?? 'public',
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    };
  }

  /** Upload a file: GCS put + persist a `files` record. */
  async upload(
    file: Express.Multer.File,
    uploader: Uploader,
    options: UploadOptions = {},
  ): Promise<FileMetadata> {
    const visibility: ObjectVisibility =
      options.visibility === 'private' ? 'private' : 'public';

    if (!this.gcs.isConfigured()) {
      throw new BadRequestException({
        code: UPLOAD_ERRORS.NOT_CONFIGURED,
        message: 'File storage is not configured',
      });
    }
    if (visibility === 'private' && !this.gcs.isPrivateConfigured()) {
      throw new BadRequestException({
        code: UPLOAD_ERRORS.NOT_CONFIGURED,
        message: 'Private file storage is not configured',
      });
    }

    const uploaded = await this.gcs.uploadBuffer(
      file,
      options.folder,
      visibility,
    );

    const doc = await this.fileModel.create({
      name: uploaded.name,
      originalName: file.originalname,
      fileType: file.mimetype,
      size: file.size,
      url: uploaded.url,
      bucket: uploaded.bucket,
      path: uploaded.path,
      uploaderType: uploader.type,
      uploaderId: new Types.ObjectId(uploader.id),
      visibility,
    });

    return this.toMetadata(doc);
  }

  /** Delete a file record + its GCS object (bucket-aware). */
  async remove(
    id: string,
    // userId kept for future ownership scoping; any authenticated user may
    // currently delete via the media library.
    _userId?: string | Types.ObjectId,
  ): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        code: UPLOAD_ERRORS.NOT_FOUND,
        message: 'File not found',
      });
    }
    const doc = await this.fileModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        code: UPLOAD_ERRORS.NOT_FOUND,
        message: 'File not found',
      });
    }

    if (this.gcs.isConfigured()) {
      await this.gcs.deleteObject(doc.path, doc.bucket);
    }
    await this.fileModel.deleteOne({ _id: doc._id }).exec();
    return { deleted: true };
  }

  /**
   * Purge-friendly remove for cascading callers (product media, KYC docs):
   * never throws — logs and reports the outcome so a single media failure
   * cannot abort the parent operation.
   */
  async removeQuietly(id: string): Promise<boolean> {
    try {
      await this.remove(id);
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Cascade file removal failed for ${id}: ${error?.message}`,
      );
      return false;
    }
  }

  /** Look up a file's metadata (or null). Used by media validators. */
  async findMetadata(id: string): Promise<FileMetadata | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await this.fileModel.findById(id).exec();
    return doc ? this.toMetadata(doc) : null;
  }

  /**
   * Mint a V4 signed URL for a file. Public files return their plain public
   * URL with `signed: false` (one endpoint serves both). When `ownerUserId`
   * is provided (user plane) the file must be a user-plane upload owned by
   * that user — anything else 404s (no cross-owner leakage).
   */
  async signedUrl(
    id: string,
    scope: { ownerUserId?: string | Types.ObjectId } = {},
  ): Promise<SignedUrlResult> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        code: UPLOAD_ERRORS.NOT_FOUND,
        message: 'File not found',
      });
    }
    const doc = await this.fileModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        code: UPLOAD_ERRORS.NOT_FOUND,
        message: 'File not found',
      });
    }

    if (scope.ownerUserId) {
      const owner = scope.ownerUserId.toString();
      if (
        (doc.uploaderType ?? 'user') !== 'user' ||
        doc.uploaderId?.toString() !== owner
      ) {
        throw new NotFoundException({
          code: UPLOAD_ERRORS.NOT_FOUND,
          message: 'File not found',
        });
      }
    }

    const meta = this.toMetadata(doc);
    if (meta.visibility !== 'private') {
      return { id: meta.id, signed: false, url: meta.url, expiresAt: null };
    }

    try {
      const { url, expiresAt } = await this.gcs.getSignedUrl(
        doc.path,
        doc.bucket,
      );
      return { id: meta.id, signed: true, url, expiresAt };
    } catch (error: any) {
      this.logger.error(`Signed-URL generation failed: ${error?.message}`);
      throw new BadGatewayException({
        code: UPLOAD_ERRORS.SIGNING_FAILED,
        message: 'Failed to generate a signed URL',
      });
    }
  }

  /** Paginated, newest-first media library from the `files` collection. */
  async mediaLibrary(query: ListMediaDto): Promise<MediaLibraryResult> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.fileModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.fileModel.countDocuments().exec(),
    ]);

    return {
      items: docs.map((d) => this.toMetadata(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
