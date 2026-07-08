/**
 * Re-exports the shared recursive `_id → id (string)` + ObjectId-stringifying
 * normalizer, applied at EVERY marketplace service return site (including
 * `.lean()` results — which bypass schema toJSON). Nested subdocuments
 * (order items, timeline entries, embedded FileMetadata) are walked too.
 */
export { serialize } from '../contributions/contributions.serializer';
