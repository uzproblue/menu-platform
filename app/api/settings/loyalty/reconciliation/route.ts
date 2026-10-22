import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  listReconciliationRunsWithAuthServer,
  runReconciliationWithAuthServer,
} from "@/lib/loyalty-api";
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
  const result = await listReconciliationRunsWithAuthServer(auth.token, auth.restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { repair?: unknown };
  const result = await runReconciliationWithAuthServer(
    auth.token,
    auth.restaurantId,
    body?.repair === true,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
