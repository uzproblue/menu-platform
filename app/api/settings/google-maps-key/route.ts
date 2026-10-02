import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { resolveGoogleMapsApiKey } from "@/lib/google-maps-key.server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = resolveGoogleMapsApiKey();
  return NextResponse.json({ key });
}
