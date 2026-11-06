import { requireWhatsappLocationAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function GET(req: Request) {
  const locationId = new URL(req.url).searchParams.get("locationId");
  const auth = await requireWhatsappLocationAccess(locationId);
  if ("response" in auth) return auth.response;
  return proxyGateway(auth.token, auth.locationId, "/v1/connections/whatsapp/status");
}
