import { Types } from 'mongoose';

/**
 * Recursively normalizes a Mongoose document / lean object / plain composed
 * object into a JSON-safe shape the frontend can consume, where:
 *
 *  - every top-level and nested `_id` (ObjectId) becomes `id` (string),
 *  - every OTHER `ObjectId` field (groupId, userId, memberId, organizerId,
 *    recipientMemberId, recipientUserId, payoutOrder[].memberId/userId,
 *    slotShift.requesterMemberId/targetMemberId, createdBy, etc.) is
 *    stringified to a plain string,
 *  - `__v` is dropped,
 *  - `createdAt` / `updatedAt` (and any other Date) are preserved as-is,
 *  - arrays and nested subdocuments are walked.
 *
 * Accepts both hydrated Mongoose documents (calls `.toObject()` when present)
 * and already-plain objects (`.lean()` results or composed returns). Safe to
 * call at any return site; returns `null`/primitives unchanged.
 */
export function serialize<T = any>(input: any): T {
  return normalize(input) as T;
}

function normalize(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // ObjectId -> string
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  // Preserve Dates verbatim
  if (value instanceof Date) {
    return value;
  }

  // Buffers / Bytes: leave untouched
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === 'object') {
    // Hydrated Mongoose document -> convert to plain object first.
    if (typeof value.toObject === 'function') {
      return normalize(value.toObject());
    }

    // Some driver values expose a toHexString (bson ObjectId variants).
    if (
      typeof value.toHexString === 'function' &&
      typeof value.equals === 'function'
    ) {
      return value.toHexString();
    }

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === '__v') {
        continue;
      }
      if (key === '_id') {
        out.id = normalize(val);
        continue;
      }
      out[key] = normalize(val);
    }
    return out;
  }

  return value;
}
