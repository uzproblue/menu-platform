import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { listGuestsWithAuthServer } from "@/lib/loyalty-api";
import type { GuestsListParams } from "@/lib/loyalty-api/types";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw === "active" || statusRaw === "blocked" ? statusRaw : undefined;
  const sortRaw = searchParams.get("sort");
  const sort =
    sortRaw === "createdAt" ||
    sortRaw === "lastVisitedAt" ||
    sortRaw === "lifetimeSpendMinor" ||
    sortRaw === "balance" ||
    sortRaw === "name"
      ? sortRaw
      : undefined;
  const orderRaw = searchParams.get("order");
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : undefined;

  const params: GuestsListParams = {
    q: searchParams.get("q") ?? undefined,
    status,
    lastVisitedFrom: searchParams.get("lastVisitedFrom") ?? undefined,
    lastVisitedTo: searchParams.get("lastVisitedTo") ?? undefined,
    minSpend: parseOptionalInt(searchParams.get("minSpend")),
    maxSpend: parseOptionalInt(searchParams.get("maxSpend")),
    page: parseOptionalInt(searchParams.get("page")),
    limit: parseOptionalInt(searchParams.get("limit")),
    sort,
    order,
  };

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await listGuestsWithAuthServer(token, restaurantId, params);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
