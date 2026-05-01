export type UploadTarget = "menu-item" | "location-logo" | "category-cover";

type SignedUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export async function uploadFileToR2(file: File, target: UploadTarget): Promise<string> {
  const signRes = await fetch("/api/uploads/r2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target,
      contentType: file.type,
      fileSize: file.size,
      fileName: file.name,
    }),
  });
  if (!signRes.ok) {
    throw new Error(await readErrorMessage(signRes, "failed to sign upload"));
  }

  const signed = (await signRes.json()) as SignedUploadResponse;

  const uploadRes = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) {
    throw new Error("failed to upload image");
  }

  return signed.publicUrl;
}
