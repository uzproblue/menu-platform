import { requireWhatsappRestaurantAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function GET(req: Request) {
  const auth = await requireWhatsappRestaurantAccess();
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const purpose =
    url.searchParams.get("purpose")?.trim().toLowerCase() === "marketing"
      ? "marketing"
      : "default";
  return proxyGateway(
    auth.token,
    auth.locationId,
    `/v1/connections/whatsapp/qr?purpose=${purpose}`,
  );
}
