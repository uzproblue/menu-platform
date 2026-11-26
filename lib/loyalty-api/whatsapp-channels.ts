export type WhatsappChannelStatus =
  | "active"
  | "needs_reauth"
  | "error"
  | "disconnected";

export type WhatsappChannelPurpose = "default" | "marketing";

export type WhatsappChannelView = {
  id: string;
  type: "whatsapp" | "instagram";
  purpose?: WhatsappChannelPurpose;
  externalId: string;
  displayName: string | null;
  status: WhatsappChannelStatus;
  tokenExpiresAt: string | null;
  lastEventAt: string | null;
};
