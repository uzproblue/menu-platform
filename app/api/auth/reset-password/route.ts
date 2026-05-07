import { NextResponse } from "next/server";
import { resetPasswordWithAuthServer } from "@/lib/auth-api";

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

  const token =
    typeof body === "object" && body !== null && "token" in body
      ? (body as { token?: unknown }).token
      : undefined;
  const newPassword =
    typeof body === "object" && body !== null && "newPassword" in body
      ? (body as { newPassword?: unknown }).newPassword
      : undefined;

  if (typeof token !== "string" || typeof newPassword !== "string") {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "token and newPassword must be strings",
      },
      { status: 400 },
    );
  }

  const result = await resetPasswordWithAuthServer(token.trim(), newPassword.trim());
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return new NextResponse(null, { status: 204 });
}
