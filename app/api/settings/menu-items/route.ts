import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createMenuItemWithAuthServer,
  type CatalogPriceInput,
  type CreateMenuItemInput,
} from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const categoryId = typeof o.categoryId === "string" ? o.categoryId.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!categoryId || !name) {
    return NextResponse.json(
      { error: "invalid_body", message: "categoryId and name are required" },
      { status: 400 },
    );
  }

  const prices: CatalogPriceInput[] = [];
  if (o.prices !== undefined && !Array.isArray(o.prices)) {
    return NextResponse.json(
      { error: "invalid_body", message: "prices must be an array when provided" },
      { status: 400 },
    );
  }
  const priceRows = Array.isArray(o.prices) ? o.prices : [];
  for (const row of priceRows) {
    if (typeof row !== "object" || row === null) {
      return NextResponse.json(
        { error: "invalid_body", message: "each price entry must be an object" },
        { status: 400 },
      );
    }
    const r = row as Record<string, unknown>;
    if (typeof r.currency !== "string" || !r.currency.trim()) {
      return NextResponse.json(
        { error: "invalid_body", message: "each price entry needs currency" },
        { status: 400 },
      );
    }
    if (
      (typeof r.price !== "string" && typeof r.price !== "number") ||
      String(r.price).trim().length === 0
    ) {
      return NextResponse.json(
        { error: "invalid_body", message: "each price entry needs price" },
        { status: 400 },
      );
    }
    prices.push({
      price: r.price,
      currency: r.currency.trim().toUpperCase(),
    });
  }

  const input: CreateMenuItemInput = {
    categoryId,
    name,
    ...(prices.length > 0 ? { prices } : {}),
  };
  if (typeof o.description === "string" && o.description.trim()) {
    input.description = o.description.trim();
  }
  if (typeof o.image === "string" && o.image.trim()) {
    input.image = o.image.trim();
  }
  if (typeof o.active === "boolean") {
    input.active = o.active;
  }
  if (Array.isArray(o.tags)) {
    input.tags = o.tags.filter((t): t is string => typeof t === "string");
  }

  const result = await createMenuItemWithAuthServer(token, input);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await syncAndPurgeAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[POST menu-items] restaurant location export batch failed",
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
    { status: 201 },
  );
}
