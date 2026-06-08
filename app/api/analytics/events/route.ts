import { NextResponse } from "next/server";
import { isClientEvent } from "@/lib/analytics/events";
import { getStaffAnalyticsContext, recordStaffEvent } from "@/lib/analytics/server";

export async function POST(req: Request) {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", message: "expected JSON object" },
      { status: 400 },
    );
  }

  const o = body as Record<string, unknown>;
  const event = typeof o.event === "string" ? o.event : "";
  if (!isClientEvent(event)) {
    return NextResponse.json(
      { error: "invalid_event", message: "event not allowed" },
      { status: 400 },
    );
  }

  const metadata =
    typeof o.metadata === "object" && o.metadata !== null && !Array.isArray(o.metadata)
      ? (o.metadata as Record<string, unknown>)
      : {};

  recordStaffEvent({
    event,
    userId: ctx.userId,
    restaurantId: ctx.restaurantId,
    role: ctx.role,
    source: "client",
    metadata,
  });

  return new NextResponse(null, { status: 204 });
}
