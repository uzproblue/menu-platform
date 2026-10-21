import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { createRestaurantAsOwnerWithAuthServer } from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session.user?.isOwner) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Only owner accounts can create restaurants",
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }

  const result = await createRestaurantAsOwnerWithAuthServer(token, name);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to create restaurant",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
