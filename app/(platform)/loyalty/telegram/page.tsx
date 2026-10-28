import type { Metadata } from "next";
import { LoyaltyTelegramClient } from "@/app/components/loyalty/loyalty-telegram-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.telegramTitle")} · Menu Platform` };
}

export default async function LoyaltyTelegramPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <LoyaltyTelegramClient />
    </div>
  );
}
