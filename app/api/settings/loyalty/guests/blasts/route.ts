import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  sendGuestBlastWithAuthServer,
  type GuestBlastChannel,
} from "@/lib/loyalty-api/guests";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

const MAX_GUESTS = 500;
const CHANNELS: GuestBlastChannel[] = ["whatsapp", "telegram", "wallet", "webpush"];

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

  const body = (await req.json().catch(() => null)) as {
    channel?: unknown;
    guestIds?: unknown;
    message?: unknown;
    title?: unknown;
    url?: unknown;
    locationId?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const channel =
    typeof body.channel === "string" && CHANNELS.includes(body.channel as GuestBlastChannel)
      ? (body.channel as GuestBlastChannel)
      : null;
  if (!channel) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "channel must be whatsapp, telegram, wallet, or webpush",
      },
      { status: 400 },
    );
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
  if (guestIds.length === 0 || guestIds.length > MAX_GUESTS) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: `guestIds must include 1–${MAX_GUESTS} guests`,
      },
      { status: 400 },
    );
  }

  const result = await sendGuestBlastWithAuthServer(token, access.restaurantId, {
    channel,
    guestIds,
    ...(typeof body.message === "string" ? { message: body.message } : {}),
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.url === "string" ? { url: body.url } : {}),
    ...(typeof body.locationId === "string" ? { locationId: body.locationId } : {}),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
