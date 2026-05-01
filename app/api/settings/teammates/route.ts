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

  const rawEmail =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email?: unknown }).email
      : undefined;
  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? (body as { name?: unknown }).name
      : undefined;
  const rawRole =
    typeof body === "object" && body !== null && "role" in body
      ? (body as { role?: unknown }).role
      : undefined;

  if (
    typeof rawEmail !== "string" ||
    typeof rawName !== "string" ||
    (rawRole !== "ADMIN" && rawRole !== "USER")
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "email, name and role are required" },
      { status: 400 },
    );
  }

  const email = rawEmail.trim().toLowerCase();
  const name = rawName.trim();
  const role = rawRole as "ADMIN" | "USER";
  if (!email.length || !email.includes("@")) {
    return NextResponse.json(
      { error: "invalid_body", message: "email must be valid" },
      { status: 400 },
    );
  }
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }

  const result = await createTeammateWithAuthServer(token, {
    email,
    name,
    role,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
