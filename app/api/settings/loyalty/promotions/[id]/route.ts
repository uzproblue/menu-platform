import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  deletePromotionWithAuthServer,
  getPromotionWithAuthServer,
  updatePromotionWithAuthServer,
} from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getPromotionWithAuthServer(token, restaurantId, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function PATCH(req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await updatePromotionWithAuthServer(
    token,
    restaurantId,
    id,
    body as Record<string, unknown>,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await deletePromotionWithAuthServer(token, restaurantId, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return new NextResponse(null, { status: 204 });
}
