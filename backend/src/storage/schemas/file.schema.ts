import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileDocument = FileEntity & Document;

/**
 * A record of a single object stored in GCP Cloud Storage. Every successful
 * upload persists one of these so the media library is DB-backed and mirrors
 * the bucket. `path` is the stored object name and is globally unique.
 */
@Schema({ timestamps: true, collection: 'files' })
export class FileEntity {
  /** Stored object name in the bucket (same value as `path`). */
  @Prop({ type: String, required: true })
  name: string;

  /** Original client-supplied filename. */
  @Prop({ type: String, required: true })
  originalName: string;

  /** MIME type. */
  @Prop({ type: String, required: true })
  fileType: string;

  /** Size in bytes. */
  @Prop({ type: Number, required: true })
  size: number;

  /** Public URL. */
  @Prop({ type: String, required: true })
  url: string;

  /** Bucket the object lives in. */
  @Prop({ type: String, required: true })
  bucket: string;

  /** Full object path/name within the bucket — unique. */
  @Prop({ type: String, required: true, unique: true })
  path: string;

  /**
   * Which plane the uploader belongs to. A file may be owned by a user
   * (`users` collection) or an admin (`adminUsers` collection), so `uploaderId`
   * is a plain ObjectId with no strict `ref` — it is resolved against the
   * collection implied by `uploaderType`.
   */
  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  uploaderType: 'user' | 'admin';

  /** Uploader's id (in the `users` or `adminUsers` collection per uploaderType). */
  @Prop({ type: Types.ObjectId, required: true })
  uploaderId: Types.ObjectId;

  /**
   * Which bucket holds the object. `public` = world-readable URL (default,
   * legacy rows without the field are treated as public). `private` = private
   * bucket (UBLA, no allUsers binding) — viewable only via V4 signed URLs.
   */
  @Prop({ type: String, enum: ['public', 'private'], default: 'public' })
  visibility: 'public' | 'private';
}

export const FileSchema = SchemaFactory.createForClass(FileEntity);

// path uniqueness declared inline on the @Prop above — do not re-declare here.
FileSchema.index({ uploaderId: 1, createdAt: -1 });

// Expose `id` (string) instead of `_id`/`__v` on serialization.
FileSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};
