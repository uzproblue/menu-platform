/** Browser-safe R2 upload limits and types (no Node / AWS imports). */

export type UploadTarget =
  | "menu-item"
  | "location-logo"
  | "qr-center-image"
  | "category-cover"
  | "section-background";

export const R2_UPLOAD_MAX_SIZE_BYTES: Record<UploadTarget, number> = {
  "menu-item": 12 * 1024 * 1024,
  "location-logo": 4 * 1024 * 1024,
  "qr-center-image": 4 * 1024 * 1024,
  "category-cover": 8 * 1024 * 1024,
  "section-background": 8 * 1024 * 1024,
};

export function getMaxUploadSizeBytes(target: UploadTarget): number {
  return R2_UPLOAD_MAX_SIZE_BYTES[target];
}
