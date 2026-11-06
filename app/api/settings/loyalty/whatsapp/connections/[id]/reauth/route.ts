import { NextResponse } from "next/server";
import { requireWhatsappRestaurantAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { isSafeId, proxyGateway } from "@/lib/meta-gateway";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireWhatsappRestaurantAccess();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  if (!isSafeId(id)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  return proxyGateway(auth.token, auth.locationId, `/v1/connections/${id}/reauth`, {
    method: "POST",
  });
}
