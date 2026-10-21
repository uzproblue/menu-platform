import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { listSegmentMembersWithAuthServer } from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { key } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await listSegmentMembersWithAuthServer(token, restaurantId, key, {
    page: parseOptionalInt(searchParams.get("page")),
    limit: parseOptionalInt(searchParams.get("limit")),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
