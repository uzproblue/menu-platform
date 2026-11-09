import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { previewGuestBlastsWithAuthServer } from "@/lib/loyalty-api/guests";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

const MAX_GUESTS = 500;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, message: access.message },
      { status: access.status },
    );
  }

  const body = (await req.json().catch(() => null)) as { guestIds?: unknown } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const guestIds = Array.isArray(body.guestIds)
    ? [
        ...new Set(
          body.guestIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  if (guestIds.length > MAX_GUESTS) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: `guestIds must be at most ${MAX_GUESTS}`,
      },
      { status: 400 },
    );
  }

  const result = await previewGuestBlastsWithAuthServer(token, access.restaurantId, {
    guestIds,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
