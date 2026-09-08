import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAuthApiTransport, authApiFetch } from "@/lib/auth-api/client";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function POST(req: Request) {
  const secret =
    process.env.VPS_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim() ||
    "";

  const rawBody = await req.text();

  // Verify HMAC signature if secret is configured
  if (secret) {
    const signature = req.headers.get("x-webhook-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing x-webhook-signature header" },
        { status: 401 },
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: "forbidden", message: "Invalid webhook signature" },
        { status: 403 },
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { event, itemId, videoId, status, hlsMasterKey } = payload as {
    event?: string;
    itemId?: string;
    videoId?: string;
    status?: string;
    hlsMasterKey?: string;
  };

  if (!itemId || typeof itemId !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId is required" },
      { status: 400 },
    );
  }

  if (status === "completed" && hlsMasterKey && typeof hlsMasterKey === "string") {
    const transport = getAuthApiTransport();
    if (!transport) {
      return NextResponse.json(
        { error: "server_unavailable", message: "menu-server transport not available" },
        { status: 503 },
      );
    }

    const internalSecret = process.env.JWT_SECRET?.trim() || "";
    const updateRes = await authApiFetch(
      transport,
      `/api/menu-items/${encodeURIComponent(itemId)}/internal-video`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ videoId: hlsMasterKey }),
      },
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => "");
      console.error(`[video-webhook] Failed to update item ${itemId} on menu-server:`, errText);
      return NextResponse.json(
        { error: "db_update_failed", message: errText },
        { status: 500 },
      );
    }

    void trackStaffMutation(PlatformEvent.VIDEO_LINKED_TO_ITEM, {
      itemId,
      videoId: hlsMasterKey,
    });

    console.log(`[video-webhook] Successfully updated item ${itemId} videoId to ${hlsMasterKey}`);
    return NextResponse.json({ ok: true, itemId, videoId: hlsMasterKey });
  }

  if (status === "failed") {
    console.error(`[video-webhook] Video transcode failed for item ${itemId}:`, payload.error);
    return NextResponse.json({ ok: true, status: "failed_logged" });
  }

  return NextResponse.json({ ok: true });
}
