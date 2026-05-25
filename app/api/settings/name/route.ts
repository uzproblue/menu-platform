import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { updateProfileNameWithAuthServer } from "@/lib/auth-api";

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

  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? (body as { name?: unknown }).name
      : undefined;

  if (typeof rawName !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "name must be a string" },
      { status: 400 },
    );
  }

  const name = rawName.trim();
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }

  const result = await updateProfileNameWithAuthServer(token, name);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
