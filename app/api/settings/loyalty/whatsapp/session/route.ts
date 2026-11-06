import { requireWhatsappLocationAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { locationId?: unknown } | null;
  const auth = await requireWhatsappLocationAccess(body?.locationId);
  if ("response" in auth) return auth.response;
  return proxyGateway(auth.token, auth.locationId, "/v1/connections/whatsapp/session", {
    method: "POST",
  });
}
