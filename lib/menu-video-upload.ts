/**
 * Shared R2 temp upload + VPS HLS transcode flow used by menu-item videos
 * and promotion story videos.
 */

export type MenuVideoUploadSession = {
  provider: "r2";
  videoId: string;
  restaurantId: string;
  uploadUrl: string;
  tempKey: string;
  publicUrl: string;
  expiresAt: string;
};

export type UploadAndTranscodeMenuVideoOptions = {
  file: File;
  /** Stable id used in the output prefix `videos/{restaurantId}/{itemId}/{videoId}/`. */
  itemId: string;
  onProgress?: (percent: number) => void;
  onStage?: (detail: string) => void;
  /** Max time to wait for VPS completion (default 5 minutes). */
  pollTimeoutMs?: number;
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const payload = (await res.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

/**
 * Uploads an MP4 to the temp R2 folder, triggers VPS transcode, polls until
 * complete, and returns the HLS master object key (e.g. `videos/.../master.m3u8`).
 */
export async function uploadAndTranscodeMenuVideo(
  options: UploadAndTranscodeMenuVideoOptions,
): Promise<string> {
  const { file, itemId, onProgress, onStage } = options;
  const pollTimeoutMs = options.pollTimeoutMs ?? 300_000;

  onStage?.("Requesting upload session...");
  const sessionRes = await fetch("/api/settings/menu-videos/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "video/mp4",
    }),
  });
  if (!sessionRes.ok) {
    throw new Error(await readErrorMessage(sessionRes, "Video upload session failed"));
  }
  const session = (await sessionRes.json()) as MenuVideoUploadSession;

  onStage?.("Uploading to R2 temp folder...");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", session.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Direct R2 upload failed with HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Video upload failed"));
    xhr.send(file);
  });

  onStage?.("Starting VPS transcoding...");
  const transcodeRes = await fetch("/api/settings/menu-videos/transcode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId,
      videoId: session.videoId,
      tempKey: session.tempKey,
    }),
  });
  if (!transcodeRes.ok) {
    throw new Error(await readErrorMessage(transcodeRes, "Transcoding trigger failed"));
  }
  const transcodeData = (await transcodeRes.json()) as { jobId: string };
  const jobId = transcodeData.jobId;

  const pollStart = Date.now();
  let completedMasterKey: string | null = null;
  while (Date.now() - pollStart < pollTimeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(
      `/api/settings/menu-videos/job-status?jobId=${encodeURIComponent(jobId)}`,
    );
    if (!statusRes.ok) continue;
    const statusData = (await statusRes.json()) as {
      status?: string;
      hlsMasterKey?: string;
      error?: string;
    };
    if (statusData.status === "completed") {
      completedMasterKey =
        statusData.hlsMasterKey ||
        `videos/${session.restaurantId}/${itemId}/${session.videoId}/master.m3u8`;
      break;
    }
    if (statusData.status === "failed") {
      throw new Error(statusData.error || "Transcoding failed on VPS");
    }
    if (statusData.status) {
      onStage?.(`VPS processing: ${statusData.status}...`);
    }
  }

  if (!completedMasterKey) {
    throw new Error("Transcoding timed out on VPS");
  }
  return completedMasterKey;
}
