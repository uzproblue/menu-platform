import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2S3Client, getR2UploadConfig } from "@/lib/r2-upload";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export function isSeasonalMenuDesignObjectKey(key: string): boolean {
  const t = key.trim().replace(/^\/+/, "");
  return t.startsWith("seasonal-menu-designs/") && t.endsWith(".json");
}

export async function getSeasonalMenuDesignFromR2(
  objectKey: string,
): Promise<
  | { ok: true; document: SeasonalMenuDocument }
  | { ok: false; error: "not_found" | "invalid" | "too_large"; message?: string }
> {
  if (!isSeasonalMenuDesignObjectKey(objectKey)) {
    return { ok: false, error: "invalid", message: "invalid object key" };
  }

  const config = getR2UploadConfig();
  const client = createR2S3Client(config);

  let body: Uint8Array;
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      }),
    );
    if (!res.Body) {
      return { ok: false, error: "not_found" };
    }
    body = await res.Body.transformToByteArray();
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    if (name === "NoSuchKey" || name === "NotFound") {
      return { ok: false, error: "not_found" };
    }
    throw err;
  }

  if (body.byteLength > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "too_large" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return { ok: false, error: "invalid", message: "invalid JSON" };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    (parsed as { version: unknown }).version !== 1
  ) {
    return { ok: false, error: "invalid", message: "unsupported document version" };
  }

  return { ok: true, document: parsed as SeasonalMenuDocument };
}

export async function putSeasonalMenuDesignToR2(
  objectKey: string,
  document: SeasonalMenuDocument,
): Promise<{ ok: true } | { ok: false; error: "invalid" | "too_large"; message?: string }> {
  if (!isSeasonalMenuDesignObjectKey(objectKey)) {
    return { ok: false, error: "invalid", message: "invalid object key" };
  }

  const jsonUtf8 = Buffer.from(JSON.stringify(document), "utf8");
  if (jsonUtf8.byteLength > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "too_large", message: "document exceeds size limit" };
  }

  const config = getR2UploadConfig();
  const client = createR2S3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: jsonUtf8,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "private, no-store",
    }),
  );

  return { ok: true };
}

export async function deleteSeasonalMenuDesignFromR2(objectKey: string): Promise<void> {
  if (!isSeasonalMenuDesignObjectKey(objectKey)) return;

  const config = getR2UploadConfig();
  const client = createR2S3Client(config);
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      }),
    );
  } catch {
    /* best-effort */
  }
}
