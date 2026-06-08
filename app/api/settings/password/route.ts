import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { updatePasswordWithAuthServer } from "@/lib/auth-api";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PATCH(req: Request) {
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

  const currentPassword =
    typeof body === "object" && body !== null && "currentPassword" in body
      ? (body as { currentPassword?: unknown }).currentPassword
      : undefined;
  const newPassword =
    typeof body === "object" && body !== null && "newPassword" in body
      ? (body as { newPassword?: unknown }).newPassword
      : undefined;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "currentPassword and newPassword must be strings",
      },
      { status: 400 },
    );
  }

  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current.length || !next.length) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "currentPassword and newPassword are required",
      },
      { status: 400 },
    );
  }
  if (next.length < 8) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "newPassword must be at least 8 characters",
      },
      { status: 400 },
    );
  }

  const result = await updatePasswordWithAuthServer(token, current, next);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  void trackStaffMutation(PlatformEvent.ACCOUNT_PASSWORD_CHANGED);

  return new NextResponse(null, { status: 204 });
}
