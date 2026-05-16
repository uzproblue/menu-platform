import { NextResponse } from "next/server";
import { provisionRestaurantWithAuthServer } from "@/lib/auth-api";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid request body" },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const adminApiKey =
    typeof raw.adminApiKey === "string" ? raw.adminApiKey.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const adminEmailRaw =
    typeof raw.adminEmail === "string" ? raw.adminEmail.trim() : "";
  const adminName =
    typeof raw.adminName === "string" && raw.adminName.trim().length
      ? raw.adminName.trim()
      : null;

  if (!adminApiKey.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "Provision API key is required" },
      { status: 400 },
    );
  }
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "Restaurant name is required" },
      { status: 400 },
    );
  }
  if (!slug.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "Slug is required" },
      { status: 400 },
    );
  }
  const adminEmail = adminEmailRaw.toLowerCase();
  if (!adminEmail.length || !adminEmail.includes("@")) {
    return NextResponse.json(
      { error: "invalid_body", message: "Admin email must be valid" },
      { status: 400 },
    );
  }

  const result = await provisionRestaurantWithAuthServer({
    adminApiKey,
    name,
    slug,
    adminEmail,
    adminName,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
