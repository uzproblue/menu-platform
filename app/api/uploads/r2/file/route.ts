import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  putValidatedUploadToR2,
  validateUploadInput,
} from "@/lib/r2-upload";
import { resolveRestaurantIdForR2Upload } from "@/lib/r2-upload-resolve-restaurant";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

function inferContentTypeForImage(file: File): string {
  const reported = file.type.trim().toLowerCase();
  if (reported.length) return reported;
  const name = file.name.trim();
  const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "expected multipart form data" },
      { status: 400 },
    );
  }

  const targetRaw = form.get("target");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "invalid_body", message: "file field is required" },
      { status: 400 },
    );
  }

  const contentType = inferContentTypeForImage(file);
  const parsed = validateUploadInput({
    target: targetRaw,
    contentType,
    fileSize: file.size,
    fileName: file.name,
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "invalid_upload", message: parsed.message },
      { status: 400 },
    );
  }

  const restaurantResult = await resolveRestaurantIdForR2Upload(session.accessToken);
  if (!restaurantResult.ok) {
    return NextResponse.json(
      {
        error: "restaurant_lookup_failed",
        message: restaurantResult.message ?? "could not resolve restaurant",
      },
      { status: restaurantResult.status },
    );
  }

  try {
    const body = Buffer.from(await file.arrayBuffer());
    const { objectKey, publicUrl } = await putValidatedUploadToR2({
      ...parsed,
      restaurantId: restaurantResult.restaurantId,
      body,
    });
    void trackStaffMutation(PlatformEvent.MEDIA_R2_UPLOADED, {
      target: parsed.target,
      objectKey,
    });

    return NextResponse.json({ objectKey, publicUrl }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "upload_failed", message: "could not store file in R2" },
      { status: 500 },
    );
  }
}
