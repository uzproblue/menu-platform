import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getGuestWithAuthServer } from "@/lib/loyalty-api";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

type Props = { params: Promise<{ guestId: string }> };

export async function GET(_req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { guestId } = await params;
  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, message: access.message },
      { status: access.status },
    );
  }
  const result = await getGuestWithAuthServer(token, access.restaurantId, guestId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
