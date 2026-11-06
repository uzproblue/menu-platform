export type WhatsappChannelStatus =
  | "active"
  | "needs_reauth"
  | "error"
  | "disconnected";

export type WhatsappChannelView = {
  id: string;
  type: "whatsapp" | "instagram";
  externalId: string;
  displayName: string | null;
  status: WhatsappChannelStatus;
  tokenExpiresAt: string | null;
  lastEventAt: string | null;
};
