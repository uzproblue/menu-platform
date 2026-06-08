import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { updateMenuItemVideoWithAuthServer } from "@/lib/auth-api";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { itemId } = await ctx.params;
  const trimmedItemId = itemId?.trim();
  if (!trimmedItemId) {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId is required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", message: "expected JSON object" },
      { status: 400 },
    );
  }

  const o = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(o, "videoId")) {
    return NextResponse.json(
      { error: "invalid_body", message: "videoId is required" },
      { status: 400 },
    );
  }

  let videoId: string | null = null;
  if (o.videoId !== null) {
    if (typeof o.videoId !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "videoId must be a string or null" },
        { status: 400 },
      );
    }
    const trimmed = o.videoId.trim();
    if (!trimmed.length) {
      return NextResponse.json(
        { error: "invalid_body", message: "videoId cannot be empty when provided" },
        { status: 400 },
      );
    }
    videoId = trimmed;
  }

  const result = await updateMenuItemVideoWithAuthServer(token, trimmedItemId, {
    videoId,
  }, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  void trackStaffMutation(
    videoId ? PlatformEvent.VIDEO_LINKED_TO_ITEM : PlatformEvent.VIDEO_REMOVED_FROM_ITEM,
    { itemId: trimmedItemId, videoId },
  );

  return NextResponse.json(result.data, { status: 200 });
}
