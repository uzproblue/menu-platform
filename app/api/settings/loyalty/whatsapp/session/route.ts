import { requireWhatsappRestaurantAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function POST() {
  const auth = await requireWhatsappRestaurantAccess();
  if ("response" in auth) return auth.response;
  return proxyGateway(auth.token, auth.locationId, "/v1/connections/whatsapp/session", {
    method: "POST",
  });
}
