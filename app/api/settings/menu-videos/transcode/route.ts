import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { resolveRestaurantIdForR2Upload } from "@/lib/r2-upload-resolve-restaurant";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const itemId = typeof o.itemId === "string" ? o.itemId.trim() : "";
  const videoId = typeof o.videoId === "string" ? o.videoId.trim() : "";
  const tempKey = typeof o.tempKey === "string" ? o.tempKey.trim() : "";

  if (!itemId || !videoId || !tempKey) {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId, videoId, and tempKey are required" },
      { status: 400 },
    );
  }

  const restaurantResult = await resolveRestaurantIdForR2Upload(session.accessToken);
  if (!restaurantResult.ok) {
    return NextResponse.json(
      { error: "restaurant_lookup_failed", message: restaurantResult.message ?? "could not resolve restaurant" },
      { status: restaurantResult.status },
    );
  }
  const restaurantId = restaurantResult.restaurantId;

  const vpsUrl = process.env.VPS_TRANSCODER_URL?.trim() || "http://localhost:8080";
  const vpsSecret = process.env.VPS_TRANSCODER_SECRET?.trim() || "";

  const reqUrl = new URL(req.url);
  const platformBaseUrl =
    process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, "") ||
    `${reqUrl.protocol}//${reqUrl.host}`;
  const callbackUrl = `${platformBaseUrl}/api/webhooks/video-transcoded`;

  try {
    const vpsRes = await fetch(`${vpsUrl.replace(/\/+$/, "")}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(vpsSecret ? { Authorization: `Bearer ${vpsSecret}` } : {}),
      },
      body: JSON.stringify({
        jobId: `job_${videoId}`,
        restaurantId,
        itemId,
        videoId,
        inputKey: tempKey,
        outputPrefix: `videos/${restaurantId}/${itemId}/${videoId}`,
        callbackUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!vpsRes.ok) {
      const errText = await vpsRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: "transcoder_error",
          message: `Transcoder service rejected job (${vpsRes.status}): ${errText}`,
        },
        { status: 502 },
      );
    }

    const vpsData = await vpsRes.json();
    return NextResponse.json({
      ok: true,
      jobId: `job_${videoId}`,
      videoId,
      itemId,
      status: (vpsData as { status?: string })?.status ?? "queued",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "transcoder_unreachable",
        message: `Could not connect to VPS transcoder service: ${msg}`,
      },
      { status: 503 },
    );
  }
}
