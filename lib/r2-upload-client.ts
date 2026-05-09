import type { UploadTarget } from "@/lib/r2-upload-shared";

export type { UploadTarget };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

/**
 * Uploads via same-origin `POST /api/uploads/r2/file` so the Worker writes to R2 with
 * server credentials. (Browser PUT to presigned `*.r2.cloudflarestorage.com` URLs requires
 * R2 bucket CORS and often fails with 403 / preflight errors when CORS is not configured.)
 */
export async function uploadFileToR2(file: File, target: UploadTarget): Promise<string> {
  const form = new FormData();
  form.set("target", target);
  form.set("file", file, file.name);

  const res = await fetch("/api/uploads/r2/file", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "failed to upload image"));
  }

  const data = (await res.json().catch(() => null)) as { publicUrl?: string } | null;
  const publicUrl = typeof data?.publicUrl === "string" ? data.publicUrl.trim() : "";
  if (!publicUrl.length) {
    throw new Error("upload response missing publicUrl");
  }
  return publicUrl;
}
