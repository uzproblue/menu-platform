import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  getWalletSystemTemplateWithAuthServer,
  putWalletSystemTemplateWithAuthServer,
  type WalletPassSystemTemplateInput,
} from "@/lib/loyalty-api";

async function authorizeOwner() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!session.user?.isOwner) {
    return {
      response: NextResponse.json(
        { error: "owner_forbidden", message: "Only owner accounts can manage the wallet template" },
        { status: 403 },
      ),
    };
  }
  return { token };
}

export async function GET() {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const result = await getWalletSystemTemplateWithAuthServer(auth.token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function PUT(req: Request) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as WalletPassSystemTemplateInput | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await putWalletSystemTemplateWithAuthServer(auth.token, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
