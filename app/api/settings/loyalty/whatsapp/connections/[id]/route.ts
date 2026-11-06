import { NextResponse } from "next/server";
import { requireWhatsappLocationAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { isSafeId, proxyGateway } from "@/lib/meta-gateway";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const locationId = new URL(req.url).searchParams.get("locationId");
  const auth = await requireWhatsappLocationAccess(locationId);
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  if (!isSafeId(id)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  return proxyGateway(auth.token, auth.locationId, `/v1/connections/${id}`, {
    method: "DELETE",
  });
}
