import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { listGuestsWithAuthServer } from "@/lib/loyalty-api";
import type { GuestsListParams, GuestsListSort } from "@/lib/loyalty-api/types";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

function parseOptionalBool(value: string | null): boolean | undefined {
  const raw = value?.trim().toLowerCase() ?? "";
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

const SORT_FIELDS: GuestsListSort[] = [
  "createdAt",
  "lastVisitedAt",
  "lifetimeSpendMinor",
  "balance",
  "name",
  "visitCount",
  "visits90d",
  "spend90d",
  "phoneE164",
  "whatsappVerifiedAt",
  "telegramVerifiedAt",
  "iikoPulledAt",
  "iikoFirstOrderAt",
  "walletInstalledAt",
  "walletPlatform",
];

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
  const sort = SORT_FIELDS.includes(sortRaw as GuestsListSort)
    ? (sortRaw as GuestsListSort)
    : undefined;
  const orderRaw = searchParams.get("order");
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : undefined;

  const isLegacy = parseOptionalBool(searchParams.get("isLegacy"));
  const verifiedRaw = searchParams.get("verified")?.trim().toLowerCase() ?? "";
  const verified =
    verifiedRaw === "whatsapp" ||
    verifiedRaw === "telegram" ||
    verifiedRaw === "any" ||
    verifiedRaw === "none"
      ? verifiedRaw
      : undefined;
  const walletPlatformRaw =
    searchParams.get("walletPlatform")?.trim().toLowerCase() ?? "";
  const walletPlatform =
    walletPlatformRaw === "apple" || walletPlatformRaw === "google"
      ? walletPlatformRaw
      : undefined;

  const params: GuestsListParams = {
    q: searchParams.get("q") ?? undefined,
    status,
    isLegacy,
    lastVisitedFrom: searchParams.get("lastVisitedFrom") ?? undefined,
    lastVisitedTo: searchParams.get("lastVisitedTo") ?? undefined,
    minSpend: parseOptionalInt(searchParams.get("minSpend")),
    maxSpend: parseOptionalInt(searchParams.get("maxSpend")),
    minVisits: parseOptionalInt(searchParams.get("minVisits")),
    maxVisits: parseOptionalInt(searchParams.get("maxVisits")),
    minBalance: parseOptionalInt(searchParams.get("minBalance")),
    maxBalance: parseOptionalInt(searchParams.get("maxBalance")),
    verified,
    hasWallet: parseOptionalBool(searchParams.get("hasWallet")),
    walletPlatform,
    iikoMatched: parseOptionalBool(searchParams.get("iikoMatched")),
    marketingConsent: parseOptionalBool(searchParams.get("marketingConsent")),
    page: parseOptionalInt(searchParams.get("page")),
    limit: parseOptionalInt(searchParams.get("limit")),
    sort,
    order,
  };

  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, message: access.message },
      { status: access.status },
    );
  }
  const result = await listGuestsWithAuthServer(token, access.restaurantId, params);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
