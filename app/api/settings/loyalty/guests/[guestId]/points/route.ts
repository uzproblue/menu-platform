import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { mutateGuestPointsWithAuthServer } from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

type Props = { params: Promise<{ guestId: string }> };

export async function POST(req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { guestId } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await mutateGuestPointsWithAuthServer(
    token,
    restaurantId,
    guestId,
    body as {
      kind: "earn" | "redeem" | "adjust";
      points: number;
      note?: string;
      reference?: string;
      idempotencyKey?: string;
    },
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  const b = body as { kind?: string; points?: number };
  const kind = b.kind;
  const event =
    kind === "earn"
      ? PlatformEvent.LOYALTY_POINTS_EARNED
      : kind === "redeem"
        ? PlatformEvent.LOYALTY_POINTS_REDEEMED
        : PlatformEvent.LOYALTY_POINTS_ADJUSTED;
  void trackStaffMutation(event, {
    guestId,
    pointsKind: kind,
    points: b.points,
  });

  return NextResponse.json(result.data);
}
