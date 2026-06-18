import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { patchLocationDiningTableChoicesWithAuthServer } from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { locationId } = await ctx.params;
  const trimmedId = locationId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { chosenTableIds?: unknown }).chosenTableIds)
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "chosenTableIds must be an array" },
      { status: 400 },
    );
  }

  const chosenTableIds = (body as { chosenTableIds: unknown[] }).chosenTableIds;
  if (!chosenTableIds.every((id) => typeof id === "string")) {
    return NextResponse.json(
      { error: "invalid_body", message: "chosenTableIds must be strings" },
      { status: 400 },
    );
  }

  const result = await patchLocationDiningTableChoicesWithAuthServer(
    token,
    trimmedId,
    { chosenTableIds },
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
