import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  getCategoriesWithAuthServer,
  getLocationsWithAuthServer,
  getTeammatesWithAuthServer,
} from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { createSignedUpload, validateUploadInput } from "@/lib/r2-upload";

async function resolveRestaurantId(
  accessToken: string,
): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string; message?: string }
> {
  const categoriesResult = await getCategoriesWithAuthServer(accessToken);
  if (categoriesResult.ok) {
    return { ok: true, restaurantId: categoriesResult.data.restaurantId };
  }

  const locationsResult = await getLocationsWithAuthServer(accessToken);
  if (locationsResult.ok) {
    return { ok: true, restaurantId: locationsResult.data.restaurantId };
  }

  const teammatesResult = await getTeammatesWithAuthServer(accessToken);
  if (teammatesResult.ok) {
    return { ok: true, restaurantId: teammatesResult.data.restaurantId };
  }

  return {
    ok: false,
    status: categoriesResult.status,
    error: categoriesResult.error,
    message: categoriesResult.message ?? "could not resolve restaurant",
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
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
  const parsed = validateUploadInput({
    target: o.target,
    contentType: o.contentType,
    fileSize: o.fileSize,
    fileName: o.fileName,
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "invalid_upload", message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const restaurantResult = await resolveRestaurantId(session.accessToken);
    if (!restaurantResult.ok) {
      return NextResponse.json(
        { error: "restaurant_lookup_failed", message: restaurantResult.message ?? "could not resolve restaurant" },
        { status: restaurantResult.status },
      );
    }

    const signed = await createSignedUpload({
      ...parsed,
      restaurantId: restaurantResult.restaurantId,
    });
    return NextResponse.json(signed, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "sign_failed", message: "could not prepare upload URL" },
      { status: 500 },
    );
  }
}
