import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  buildTusUploadSession,
  createStreamVideo,
  getBunnyStreamConfig,
} from "@/lib/bunny-stream";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = getBunnyStreamConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "bunny_not_configured",
        message: "BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY must be set",
      },
      { status: 503 },
    );
  }

  let title = "Menu item video";
  try {
    const body = (await req.json()) as { title?: unknown };
    if (typeof body?.title === "string" && body.title.trim().length) {
      title = body.title.trim().slice(0, 200);
    }
  } catch {
    /* empty body is fine */
  }

  const created = await createStreamVideo(config, title);
  if (!created.ok) {
    return NextResponse.json(
      { error: "bunny_create_failed", message: created.message },
      { status: created.status && created.status >= 400 ? created.status : 502 },
    );
  }

  const sessionPayload = buildTusUploadSession(config, created.videoId);
  return NextResponse.json(sessionPayload);
}
