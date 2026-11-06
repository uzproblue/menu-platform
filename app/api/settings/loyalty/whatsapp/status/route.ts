import { requireWhatsappRestaurantAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function GET() {
  const auth = await requireWhatsappRestaurantAccess();
  if ("response" in auth) return auth.response;
  return proxyGateway(auth.token, auth.locationId, "/v1/connections/whatsapp/status");
}
