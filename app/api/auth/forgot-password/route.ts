import { NextResponse } from "next/server";
import { requestPasswordResetWithAuthServer } from "@/lib/auth-api";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
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
  if (typeof rawEmail !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "email is required" },
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

  const result = await requestPasswordResetWithAuthServer(email);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true });
}
