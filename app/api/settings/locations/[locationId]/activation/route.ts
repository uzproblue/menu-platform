import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { updateLocationActivationWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeLocationPublicExport,
} from "@/lib/sync-location-public-export";

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

  const exportResult = await syncAndPurgeLocationPublicExport(token, trimmedId);
  if (!exportResult.ok) {
    console.error(
      "[PATCH location activation] location public export failed",
      trimmedId,
      exportResult.message,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          ...result.data,
          error: "location_export_failed",
          message: exportResult.message,
          locationExport: { ok: false as const, message: exportResult.message },
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      ...result.data,
      locationExport: exportResult.ok
        ? { ok: true as const, publicUrl: exportResult.publicUrl }
        : { ok: false as const, message: exportResult.message },
    },
    { status: 200 },
  );
}
