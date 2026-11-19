/**
 * Deterministic public CDN URL for a location's 2GIS YML feed.
 * Object key: `2gis/{locationId}/2gis.yml`
 */
export function makeTwoGisExportObjectKey(locationId: string): string {
  const safe = locationId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe.length) {
    throw new Error("invalid locationId for 2GIS export object key");
  }
  return `2gis/${safe}/2gis.yml`;
}

export function makeTwoGisExportPublicUrl(locationId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const key = makeTwoGisExportObjectKey(locationId);
  return base ? `${base}/${key}` : `/${key}`;
}
