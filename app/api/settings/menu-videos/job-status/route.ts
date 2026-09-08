import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId")?.trim();
  if (!jobId) {
    return NextResponse.json(
      { error: "invalid_query", message: "jobId is required" },
      { status: 400 },
    );
  }

  const vpsUrl = process.env.VPS_TRANSCODER_URL?.trim() || "http://localhost:8080";
  const vpsSecret = process.env.VPS_TRANSCODER_SECRET?.trim() || "";

  try {
    const vpsRes = await fetch(`${vpsUrl.replace(/\/+$/, "")}/api/jobs/${encodeURIComponent(jobId)}`, {
      headers: {
        ...(vpsSecret ? { Authorization: `Bearer ${vpsSecret}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!vpsRes.ok) {
      return NextResponse.json(
        { error: "not_found", message: "Job not found on transcoder" },
        { status: vpsRes.status },
      );
    }

    const data = await vpsRes.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "vps_unreachable", message: `Could not reach transcoder: ${msg}` },
      { status: 503 },
    );
  }
}
