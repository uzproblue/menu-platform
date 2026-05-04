import { PutObjectCommand } from "@aws-sdk/client-s3";
import { brotliCompressSync } from "node:zlib";
import type { LocationPublicExport } from "@/lib/data/location-public-export";
import { createR2S3Client, getR2UploadConfig } from "@/lib/r2-upload";

/**
 * Deterministic object keys for guest-facing location menu snapshots.
 *
 * Bytes on R2 are **Brotli-compressed JSON**; object metadata uses `Content-Encoding: br` and
 * `Content-Type: application/json`, so `fetch` + `response.json()` decode transparently.
 *
 * **Public reads:** Configure R2 (or your CDN in front of `R2_PUBLIC_BASE_URL`) so objects
 * under prefix `location-public/v1/` are readable without auth — same as your image assets.
 *
 * **Example URL for the client menu app:**
 * `{R2_PUBLIC_BASE_URL}/location-public/v1/{locationId}.json`
 * e.g. `https://cdn.example.com/location-public/v1/clxxxxxxxx.json`
 */
export function makeLocationPublicExportObjectKey(locationId: string): string {
  const safe = locationId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe.length) {
    throw new Error("invalid locationId for export object key");
  }
  return `location-public/v1/${safe}.json`;
}

export async function putLocationPublicExportToR2(
  locationId: string,
  payload: LocationPublicExport,
): Promise<{ objectKey: string; publicUrl: string }> {
  const config = getR2UploadConfig();
  const client = createR2S3Client(config);
  const objectKey = makeLocationPublicExportObjectKey(locationId);
  const jsonUtf8 = Buffer.from(JSON.stringify(payload), "utf8");
  const body = brotliCompressSync(jsonUtf8);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: "application/json; charset=utf-8",
      ContentEncoding: "br",
      CacheControl:
        "public, max-age=300, s-maxage=600, stale-while-revalidate=120",
    }),
  );
  return {
    objectKey,
    publicUrl: `${config.publicBaseUrl}/${objectKey}`,
  };
}
