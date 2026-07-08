/**
 * Re-exports the shared recursive `_id → id (string)` + ObjectId-stringifying
 * normalizer. Kept as a thin module-local alias so equipment code imports from
 * within its own domain, matching the contributions template.
 */
export { serialize } from '../contributions/contributions.serializer';
