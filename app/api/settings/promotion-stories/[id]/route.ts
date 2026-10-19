import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  deletePromotionStoryWithAuthServer,
  getPromotionStoryWithAuthServer,
  type PromotionStoryMutationBody,
  updatePromotionStoryWithAuthServer,
} from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  isLocationExportStrict,
  scheduleOrAwaitAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getPromotionStoryWithAuthServer(token, id, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function PATCH(req: Request, { params }: Params) {
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

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await updatePromotionStoryWithAuthServer(
    token,
    id,
    restaurantId,
    body as PromotionStoryMutationBody,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await scheduleOrAwaitAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok && isLocationExportStrict()) {
    return NextResponse.json(
      {
        ...result.data,
        error: "location_export_failed",
        message: "One or more location exports failed",
        locationExportBatch: exportBatchResult,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(result.data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await deletePromotionStoryWithAuthServer(token, id, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await scheduleOrAwaitAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok && isLocationExportStrict()) {
    return NextResponse.json(
      {
        error: "location_export_failed",
        message: "One or more location exports failed",
        locationExportBatch: exportBatchResult,
      },
      { status: 503 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
