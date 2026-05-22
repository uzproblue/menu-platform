import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  fetchMenuImageForProxy,
  isAllowedMenuImageProxyUrl,
  resolveMenuAssetToAbsoluteUrl,
} from "@/lib/menu-image-proxy";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const src = new URL(req.url).searchParams.get("src")?.trim();
  if (!src) {
    return NextResponse.json({ error: "invalid_query", message: "src is required" }, { status: 400 });
  }

  if (!isAllowedMenuImageProxyUrl(src)) {
    return NextResponse.json({ error: "forbidden", message: "image URL not allowed" }, { status: 403 });
  }

  const absoluteUrl = resolveMenuAssetToAbsoluteUrl(src);
  if (!absoluteUrl) {
    return NextResponse.json({ error: "invalid_src" }, { status: 400 });
  }

  const result = await fetchMenuImageForProxy(absoluteUrl);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status === 415 || result.status === 413 ? result.status : 502 },
    );
  }

  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
