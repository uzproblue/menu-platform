import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type UploadTarget = "menu-item" | "location-logo" | "category-cover";

export type R2UploadConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  signedUrlTtlSeconds: number;
};

const targetFolderMap: Record<UploadTarget, string> = {
  "menu-item": "menu-items",
  "location-logo": "locations",
  "category-cover": "category-covers",
};

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const maxSizeBytesByTarget: Record<UploadTarget, number> = {
  "menu-item": 12 * 1024 * 1024,
  "location-logo": 4 * 1024 * 1024,
  "category-cover": 8 * 1024 * 1024,
};

export function getMaxUploadSizeBytes(target: UploadTarget): number {
  return maxSizeBytesByTarget[target];
}

function readNonEmptyEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function readOptionalNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  return Math.floor(n);
}

export function getR2UploadConfig(): R2UploadConfig {
  const accountId = readNonEmptyEnv("R2_ACCOUNT_ID");
  const accessKeyId = readNonEmptyEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = readNonEmptyEnv("R2_SECRET_ACCESS_KEY");
  const bucket = readNonEmptyEnv("R2_BUCKET");
  const publicBaseUrl = readNonEmptyEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const signedUrlTtlSeconds = readOptionalNumberEnv("R2_SIGNED_URL_TTL_SECONDS", 300);
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    signedUrlTtlSeconds,
  };
}

export function validateUploadInput(input: {
  target: unknown;
  contentType: unknown;
  fileSize: unknown;
  fileName: unknown;
}):
  | { ok: true; target: UploadTarget; contentType: string; fileSize: number; extension: string }
  | { ok: false; message: string } {
  const target = typeof input.target === "string" ? (input.target as UploadTarget) : null;
  if (!target || !(target in targetFolderMap)) {
    return { ok: false, message: "invalid upload target" };
  }

  const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : "";
  if (!allowedMimeTypes.has(contentType)) {
    return { ok: false, message: "unsupported file type" };
  }

  const fileSize = typeof input.fileSize === "number" ? input.fileSize : Number(input.fileSize);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, message: "invalid file size" };
  }
  if (fileSize > maxSizeBytesByTarget[target]) {
    const maxMb = Math.round(maxSizeBytesByTarget[target] / (1024 * 1024));
    return { ok: false, message: `file is too large (max ${maxMb}MB)` };
  }

  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const extension = getSafeExtension(fileName, contentType);
  return { ok: true, target, contentType, fileSize, extension };
}

function getSafeExtension(fileName: string, contentType: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "" : "";
  const allow = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);
  if (allow.has(fromName)) return fromName;
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function makeObjectKey(target: UploadTarget, extension: string, restaurantId: string): string {
  const safeRestaurantId = sanitizePathSegment(restaurantId);
  const day = new Date().toISOString().slice(0, 10);
  const fileName = `${randomUUID()}.${extension}`;

  if (target === "location-logo") {
    return `${targetFolderMap[target]}/${day}/${fileName}`;
  }
  return `${targetFolderMap[target]}/${safeRestaurantId}/${day}/${fileName}`;
}

function getS3Client(config: R2UploadConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** Shared client for server-side bucket writes (e.g. public JSON exports). */
export function createR2S3Client(config: R2UploadConfig): S3Client {
  return getS3Client(config);
}

export async function createSignedUpload(input: {
  target: UploadTarget;
  contentType: string;
  extension: string;
  restaurantId: string;
}): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string; expiresAt: string }> {
  const config = getR2UploadConfig();
  const objectKey = makeObjectKey(input.target, input.extension, input.restaurantId);
  const client = getS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.signedUrlTtlSeconds,
  });
  const expiresAt = new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString();
  return {
    uploadUrl,
    objectKey,
    publicUrl: `${config.publicBaseUrl}/${objectKey}`,
    expiresAt,
  };
}
