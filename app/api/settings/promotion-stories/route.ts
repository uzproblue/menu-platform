import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  createPromotionStoryWithAuthServer,
  listPromotionStoriesWithAuthServer,
  type PromotionStoryMutationBody,
} from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { syncAndPurgeLocationIds } from "@/lib/sync-location-public-export";

function locationIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { locationIds?: unknown }).locationIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await listPromotionStoriesWithAuthServer(token, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST(req: Request) {
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

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await createPromotionStoryWithAuthServer(
    token,
    restaurantId,
    body as PromotionStoryMutationBody,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const locationIds = [
    ...locationIdsFromBody(body),
    ...(result.data.story.locationIds ?? []),
  ];
  const locationExportBatch = await syncAndPurgeLocationIds(
    token,
    locationIds,
    4,
    restaurantId,
  );
  if (!locationExportBatch.ok) {
    return NextResponse.json(
      {
        ...result.data,
        error: "location_export_failed",
        message: "One or more location exports failed",
        locationExportBatch,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { ...result.data, locationExportBatch },
    { status: 201 },
  );
}
