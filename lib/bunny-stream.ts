import { createHash } from "node:crypto";

export const BUNNY_TUS_UPLOAD_ENDPOINT = "https://video.bunnycdn.com/tusupload";

const BUNNY_VIDEO_API_BASE = "https://video.bunnycdn.com";

/** Default TUS presign lifetime (1 hour). */
export const BUNNY_TUS_EXPIRE_SECONDS = 3600;

export type BunnyStreamConfig = {
  libraryId: string;
  apiKey: string;
};

export function getBunnyStreamConfig(): BunnyStreamConfig | null {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!libraryId || !apiKey) return null;
  return { libraryId, apiKey };
}

export type CreateStreamVideoResult =
  | { ok: true; videoId: string; libraryId: string }
  | { ok: false; message: string; status?: number };

export async function createStreamVideo(
  config: BunnyStreamConfig,
  title: string,
): Promise<CreateStreamVideoResult> {
  const url = `${BUNNY_VIDEO_API_BASE}/library/${encodeURIComponent(config.libraryId)}/videos`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        AccessKey: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ title: title.trim() || "Menu item video" }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, message: "Could not reach Bunny Stream API" };
  }

  if (!res.ok) {
    let message = `Bunny Stream create failed (${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string };
      if (payload.message?.trim()) message = payload.message.trim();
    } catch {
      /* ignore */
    }
    return { ok: false, message, status: res.status };
  }

  let payload: { guid?: string; videoId?: string };
  try {
    payload = (await res.json()) as { guid?: string; videoId?: string };
  } catch {
    return { ok: false, message: "Invalid response from Bunny Stream API" };
  }

  const videoId = (payload.guid ?? payload.videoId)?.trim();
  if (!videoId) {
    return { ok: false, message: "Bunny Stream did not return a video id" };
  }

  return { ok: true, videoId, libraryId: config.libraryId };
}

/**
 * Presigned TUS upload signature per Bunny docs:
 * SHA256(libraryId + apiKey + expirationUnix + videoId) as hex.
 */
export function signTusUpload(
  config: BunnyStreamConfig,
  videoId: string,
  expireUnixSec: number,
): string {
  const raw = `${config.libraryId}${config.apiKey}${expireUnixSec}${videoId}`;
  return createHash("sha256").update(raw).digest("hex");
}

export function buildTusUploadSession(
  config: BunnyStreamConfig,
  videoId: string,
  expireUnixSec: number = Math.floor(Date.now() / 1000) + BUNNY_TUS_EXPIRE_SECONDS,
) {
  return {
    videoId,
    libraryId: config.libraryId,
    tusEndpoint: BUNNY_TUS_UPLOAD_ENDPOINT,
    authorizationSignature: signTusUpload(config, videoId, expireUnixSec),
    authorizationExpire: expireUnixSec,
  };
}
