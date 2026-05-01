import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { updateLocationActivationWithAuthServer } from "@/lib/auth-api";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const rawIsActive =
    typeof body === "object" && body !== null && "isActive" in body
      ? (body as { isActive?: unknown }).isActive
      : undefined;
  if (typeof rawIsActive !== "boolean") {
    return NextResponse.json(
      { error: "invalid_body", message: "isActive must be a boolean" },
      { status: 400 },
    );
  }

  const result = await updateLocationActivationWithAuthServer(token, trimmedId, {
    isActive: rawIsActive,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
