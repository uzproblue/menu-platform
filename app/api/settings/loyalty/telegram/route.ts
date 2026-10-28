import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  getRestaurantTelegramWithAuthServer,
  putRestaurantTelegramWithAuthServer,
} from "@/lib/loyalty-api/telegram";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

async function authorize() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return {
      response: NextResponse.json(
        { error: access.error, message: access.message },
        { status: access.status },
      ),
    };
  }
  return { token, restaurantId: access.restaurantId };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const result = await getRestaurantTelegramWithAuthServer(
    auth.token,
    auth.restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function PUT(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    username?: unknown;
    botToken?: unknown;
    enabled?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const payload: {
    username?: string | null;
    botToken?: string | null;
    enabled?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(body, "username")) {
    if (body.username === null || body.username === "") {
      payload.username = null;
    } else if (typeof body.username === "string") {
      payload.username = body.username;
    } else {
      return NextResponse.json(
        { error: "invalid_body", message: "username must be string" },
        { status: 400 },
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "botToken")) {
    if (body.botToken === null || body.botToken === "") {
      payload.botToken = null;
    } else if (typeof body.botToken === "string") {
      payload.botToken = body.botToken;
    } else {
      return NextResponse.json(
        { error: "invalid_body", message: "botToken must be string" },
        { status: 400 },
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "invalid_body", message: "enabled must be boolean" },
        { status: 400 },
      );
    }
    payload.enabled = body.enabled;
  }

  const result = await putRestaurantTelegramWithAuthServer(
    auth.token,
    auth.restaurantId,
    payload,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
