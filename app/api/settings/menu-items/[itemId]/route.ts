import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { deleteMenuItemWithAuthServer, updateMenuItemWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { itemId } = await ctx.params;
  const trimmedItemId = itemId?.trim();
  if (!trimmedItemId) {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId is required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", message: "expected JSON object" },
      { status: 400 },
    );
  }

  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const currency = typeof o.currency === "string" ? o.currency.trim().toUpperCase() : "";
  const price = o.price;
  if (!name || !currency || (typeof price !== "string" && typeof price !== "number")) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "name, price, and currency are required",
      },
      { status: 400 },
    );
  }

  const input: {
    name: string;
    description?: string | null;
    image?: string | null;
    price: string | number;
    currency: string;
  } = {
    name,
    price,
    currency,
  };
  if (typeof o.description === "string") {
    input.description = o.description.trim() || null;
  } else if (o.description === null) {
    input.description = null;
  }
  if (typeof o.image === "string") {
    input.image = o.image.trim() || null;
  } else if (o.image === null) {
    input.image = null;
  }

  const result = await updateMenuItemWithAuthServer(token, trimmedItemId, input);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await syncAndPurgeAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[PATCH menu-item] restaurant location export batch failed",
      exportBatchResult.failures,
    );
    if (isLocationExportStrict()) {
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
  }

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 200 },
  );
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { itemId } = await ctx.params;
  const trimmedItemId = itemId?.trim();
  if (!trimmedItemId) {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId is required" },
      { status: 400 },
    );
  }

  const result = await deleteMenuItemWithAuthServer(token, trimmedItemId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await syncAndPurgeAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[DELETE menu-item] restaurant location export batch failed",
      exportBatchResult.failures,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          error: "location_export_failed",
          message: "One or more location exports failed",
          locationExportBatch: exportBatchResult,
        },
        { status: 503 },
      );
    }
  }

  return new NextResponse(null, { status: 204 });
}
