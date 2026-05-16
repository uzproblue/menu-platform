import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createTeammateWithAuthServer,
  getTeammatesWithAuthServer,
} from "@/lib/auth-api";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getTeammatesWithAuthServer(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

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
  const rawName = o.name;
  const rawRole = o.role;

  if (typeof rawName !== "string" || typeof rawRole !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "name and role are required" },
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

  if (rawRole === "CHEF") {
    const rawPhone = o.telegramPhone;
    const rawLocationId = o.locationId;
    if (typeof rawPhone !== "string" || typeof rawLocationId !== "string") {
      return NextResponse.json(
        {
          error: "invalid_body",
          message: "telegramPhone and locationId are required for CHEF",
        },
        { status: 400 },
      );
    }
    const telegramPhone = rawPhone.trim();
    const locationId = rawLocationId.trim();
    if (!telegramPhone.length || !locationId.length) {
      return NextResponse.json(
        {
          error: "invalid_body",
          message: "telegramPhone and locationId are required for CHEF",
        },
        { status: 400 },
      );
    }

    const result = await createTeammateWithAuthServer(token, {
      name,
      role: "CHEF",
      telegramPhone,
      locationId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json(result.data, { status: 201 });
  }

  const rawEmail = o.email;
  if (typeof rawEmail !== "string" || (rawRole !== "ADMIN" && rawRole !== "USER")) {
    return NextResponse.json(
      { error: "invalid_body", message: "email, name and role are required" },
      { status: 400 },
    );
  }

  const email = rawEmail.trim().toLowerCase();
  if (!email.length || !email.includes("@")) {
    return NextResponse.json(
      { error: "invalid_body", message: "email must be valid" },
      { status: 400 },
    );
  }

  const result = await createTeammateWithAuthServer(token, {
    email,
    name,
    role: rawRole as "ADMIN" | "USER",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
