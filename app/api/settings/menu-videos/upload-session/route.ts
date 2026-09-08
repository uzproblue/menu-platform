import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth-options";
import { resolveRestaurantIdForR2Upload } from "@/lib/r2-upload-resolve-restaurant";
import { createSignedUpload } from "@/lib/r2-upload";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  let contentType = "video/mp4";
  let fileName = "video.mp4";
  try {
    const body = (await req.json()) as { contentType?: unknown; fileName?: unknown };
    if (typeof body?.contentType === "string" && body.contentType.trim().length) {
      contentType = body.contentType.trim().toLowerCase();
    }
    if (typeof body?.fileName === "string" && body.fileName.trim().length) {
      fileName = body.fileName.trim();
    }
  } catch {
    /* empty body is fine */
  }

  const videoId = randomUUID();
  const ext = fileName.endsWith(".mov")
    ? "mov"
    : fileName.endsWith(".webm")
      ? "webm"
      : "mp4";

  try {
    const signed = await createSignedUpload({
      target: "temp-video",
      contentType,
      extension: ext,
      restaurantId: restaurantResult.restaurantId,
    });

    void trackStaffMutation(PlatformEvent.VIDEO_UPLOAD_SESSION_STARTED, {
      videoId,
      tempKey: signed.objectKey,
    });

    return NextResponse.json({
      provider: "r2",
      videoId,
      restaurantId: restaurantResult.restaurantId,
      uploadUrl: signed.uploadUrl,
      tempKey: signed.objectKey,
      publicUrl: signed.publicUrl,
      expiresAt: signed.expiresAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "sign_failed", message: `Could not prepare upload URL: ${msg}` },
      { status: 500 },
    );
  }
}
