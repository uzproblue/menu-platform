import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { deleteRestaurantWithAuthServer } from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ restaurantId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session.user?.isOwner) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Only owner accounts can delete restaurants",
      },
      { status: 403 },
    );
  }

  const { restaurantId } = await ctx.params;
  const trimmedId = restaurantId?.trim() ?? "";
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "restaurantId is required" },
      { status: 400 },
    );
  }

  const result = await deleteRestaurantWithAuthServer(token, trimmedId);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to delete restaurant",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
