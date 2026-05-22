import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createSeasonalMenuDesignWithAuthServer,
  deleteSeasonalMenuDesignWithAuthServer,
  listSeasonalMenuDesignsWithAuthServer,
} from "@/lib/auth-api";
import { createEmptySeasonalMenuDocument } from "@/lib/seasonal-menu/empty-document";
import { putSeasonalMenuDesignToR2 } from "@/lib/r2-seasonal-menu-design";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await listSeasonalMenuDesignsWithAuthServer(token);
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
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const rawTitle =
    typeof body === "object" && body !== null && "title" in body
      ? (body as { title?: unknown }).title
      : undefined;
  const rawLocationId =
    typeof body === "object" && body !== null && "locationId" in body
      ? (body as { locationId?: unknown }).locationId
      : undefined;

  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "title is required" },
      { status: 400 },
    );
  }

  const locationId =
    typeof rawLocationId === "string" && rawLocationId.trim().length
      ? rawLocationId.trim()
      : rawLocationId === null
        ? null
        : undefined;

  const result = await createSeasonalMenuDesignWithAuthServer(token, {
    title,
    ...(locationId !== undefined ? { locationId } : {}),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const putResult = await putSeasonalMenuDesignToR2(
    result.data.design.r2ObjectKey,
    createEmptySeasonalMenuDocument(),
  );
  if (!putResult.ok) {
    await deleteSeasonalMenuDesignWithAuthServer(token, result.data.design.id);
    return NextResponse.json(
      { error: putResult.error, message: putResult.message ?? "failed to store canvas" },
      { status: 500 },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
