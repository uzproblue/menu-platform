import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  previewWalletMarketingWithAuthServer,
  sendWalletMarketingWithAuthServer,
  type LoyaltySegmentKey,
} from "@/lib/loyalty-api";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

async function authorize() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return {
      response: NextResponse.json(
        { error: access.error, message: access.message },
        { status: access.status },
      ),
    };
  }
  return { token, restaurantId: access.restaurantId };
}

export async function GET(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const segmentsRaw = url.searchParams.get("segments")?.trim() ?? "";
  const segmentKeys = segmentsRaw
    ? (segmentsRaw.split(",").map((s) => s.trim()).filter(Boolean) as LoyaltySegmentKey[])
    : [];
  const requireMarketingConsent =
    url.searchParams.get("requireMarketingConsent") !== "false";
  const result = await previewWalletMarketingWithAuthServer(
    auth.token,
    auth.restaurantId,
    { segmentKeys, requireMarketingConsent },
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    segmentKeys?: unknown;
    requireMarketingConsent?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  const segmentKeys = Array.isArray(body.segmentKeys)
    ? (body.segmentKeys.filter((k): k is LoyaltySegmentKey => typeof k === "string") as LoyaltySegmentKey[])
    : [];
  const result = await sendWalletMarketingWithAuthServer(
    auth.token,
    auth.restaurantId,
    {
      message,
      segmentKeys,
      requireMarketingConsent: body.requireMarketingConsent !== false,
    },
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
