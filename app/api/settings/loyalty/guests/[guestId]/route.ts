import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getGuestWithAuthServer } from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

type Props = { params: Promise<{ guestId: string }> };

export async function GET(_req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { guestId } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getGuestWithAuthServer(token, restaurantId, guestId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
