import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  MarketplaceErrorCode,
  MarketplaceException,
} from './marketplace.constants';

/** Business id: "PRD_<ts>_<rand>" / "MCH_<ts>_<rand>" / "MPR_<ts>_<rand>". */
export function genBizId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

/** Order/checkout refs: "ORD<ts><RAND>" / "CHK<ts><RAND>" (cart_checkout.md). */
export function genRef(prefix: string): string {
  return `${prefix}${Date.now()}${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Validate an :id path param as ObjectId or 404 with the given code. */
export function toObjectId(
  id: string,
  code: MarketplaceErrorCode,
): Types.ObjectId {
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new MarketplaceException(code, HttpStatus.NOT_FOUND);
  }
  return new Types.ObjectId(id);
}

/**
 * Buyer-visibility filter (storefront §4, locked): APPROVED + ACTIVE +
 * not suspended + not deleted. (Category activity is checked separately.)
 */
export const BUYER_VISIBILITY_FILTER = {
  moderationStatus: 'APPROVED',
  status: 'ACTIVE',
  suspended: { $ne: true },
  deletedAt: null,
} as const;

/** Is a plain product object buyer-visible (category check excluded)? */
export function isBuyerVisible(product: any): boolean {
  return (
    product &&
    product.moderationStatus === 'APPROVED' &&
    product.status === 'ACTIVE' &&
    product.suspended !== true &&
    !product.deletedAt
  );
}

/** floor(subtotal × pct / 100) — merchant-side platform fee (cart_checkout §4.1). */
export function computePlatformFee(subtotal: number, percent: number): number {
  return Math.floor((subtotal * percent) / 100);
}

/**
 * Validate + normalize product media (max 3 images / 1 video). Entries may be
 * embedded FileMetadata objects or bare file-id strings; each id is
 * re-validated against the `files` index and the CANONICAL server-side
 * metadata is embedded (client-sent fields are never trusted).
 */
export async function validateAndNormalizeMedia(
  uploadService: {
    findMetadata: (id: string) => Promise<Record<string, any> | null>;
  },
  images: any[] | undefined,
  video: any | undefined,
  codes: { cap: MarketplaceErrorCode; notFound: MarketplaceErrorCode },
  options: { minImages?: number } = {},
): Promise<{
  images: Record<string, any>[];
  video: Record<string, any> | null;
}> {
  const imageInputs = Array.isArray(images) ? images : [];
  const minImages = options.minImages ?? 0;
  if (imageInputs.length > 3) {
    throw new MarketplaceException(codes.cap, HttpStatus.UNPROCESSABLE_ENTITY, {
      images: imageInputs.length,
      maxImages: 3,
    });
  }
  if (imageInputs.length < minImages) {
    throw new MarketplaceException(codes.cap, HttpStatus.UNPROCESSABLE_ENTITY, {
      images: imageInputs.length,
      minImages,
    });
  }

  const resolve = async (
    entry: any,
    kind: 'image' | 'video',
  ): Promise<Record<string, any>> => {
    const id =
      typeof entry === 'string' ? entry : entry?.id || entry?.fileId || '';
    const meta = id ? await uploadService.findMetadata(id) : null;
    if (!meta) {
      throw new MarketplaceException(codes.notFound, HttpStatus.NOT_FOUND, {
        id: id || null,
      });
    }
    const prefix = kind === 'video' ? 'video/' : 'image/';
    if (!String(meta.fileType || '').startsWith(prefix)) {
      throw new MarketplaceException(
        codes.cap,
        HttpStatus.UNPROCESSABLE_ENTITY,
        { id, fileType: meta.fileType, expected: `${prefix}*` },
      );
    }
    return meta;
  };

  const normalizedImages: Record<string, any>[] = [];
  for (const entry of imageInputs) {
    normalizedImages.push(await resolve(entry, 'image'));
  }

  let normalizedVideo: Record<string, any> | null = null;
  if (video) {
    if (Array.isArray(video)) {
      throw new MarketplaceException(
        codes.cap,
        HttpStatus.UNPROCESSABLE_ENTITY,
        { video: video.length, maxVideo: 1 },
      );
    }
    normalizedVideo = await resolve(video, 'video');
  }

  return { images: normalizedImages, video: normalizedVideo };
}

/** File-ids present in `previous` media but absent from `next` (for cascade delete). */
export function removedMediaIds(
  previousImages: any[] | undefined,
  previousVideo: any | undefined,
  nextImages: any[] | undefined,
  nextVideo: any | undefined,
): string[] {
  const nextIds = new Set(
    [...(nextImages || []), nextVideo]
      .filter(Boolean)
      .map((m: any) => String(m.id)),
  );
  return [...(previousImages || []), previousVideo]
    .filter(Boolean)
    .map((m: any) => String(m.id))
    .filter((id) => id && !nextIds.has(id));
}

/** Mask an ID number: all but the last 4 characters. */
export function maskIdNumber(idNumber?: string | null): string | null {
  if (!idNumber) {
    return null;
  }
  const tail = idNumber.slice(-4);
  return `${'•'.repeat(Math.max(3, idNumber.length - 4))}${tail}`;
}
