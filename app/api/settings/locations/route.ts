import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createLocationWithAuthServer,
  getLocationsWithAuthServer,
} from "@/lib/auth-api";
import { validateTranslationLangsInput } from "@/lib/menu-translation-langs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getLocationsWithAuthServer(token);
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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const currency = typeof o.currency === "string" ? o.currency.trim().toUpperCase() : "";
  const logoUrl = typeof o.logoUrl === "string" ? o.logoUrl.trim() : "";
  const rawAddress = typeof o.address === "string" ? o.address.trim() : "";
  const rawTranslationLangs = Array.isArray(o.translationLangs)
    ? o.translationLangs
    : undefined;
  if (rawAddress.length > 1000) {
    return NextResponse.json(
      { error: "invalid_body", message: "address must be at most 1000 characters" },
      { status: 400 },
    );
  }
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }
  if (!currency || currency.length !== 3) {
    return NextResponse.json(
      { error: "invalid_body", message: "currency is required (ISO 4217)" },
      { status: 400 },
    );
  }
  const translationCandidates = (rawTranslationLangs ?? []).filter(
    (x): x is string => typeof x === "string",
  );
  const translationParsed = validateTranslationLangsInput(translationCandidates);
  if (!translationParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: translationParsed.message },
      { status: 400 },
    );
  }
  const translationLangs = translationParsed.value;

  const result = await createLocationWithAuthServer(token, {
    name,
    currency,
    translationLangs,
    logoUrl: logoUrl || undefined,
    address: rawAddress || undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
