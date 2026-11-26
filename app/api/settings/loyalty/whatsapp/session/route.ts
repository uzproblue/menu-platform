import { requireWhatsappRestaurantAccess } from "@/lib/loyalty-api/whatsapp-guard";
import { proxyGateway } from "@/lib/meta-gateway";

export async function POST(req: Request) {
  const auth = await requireWhatsappRestaurantAccess();
  if ("response" in auth) return auth.response;
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }
  const purpose =
    typeof body.purpose === "string" && body.purpose.trim().toLowerCase() === "marketing"
      ? "marketing"
      : "default";
  return proxyGateway(auth.token, auth.locationId, "/v1/connections/whatsapp/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose }),
  });
}
