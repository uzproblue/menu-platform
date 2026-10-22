import type { Metadata } from "next";
import { LoyaltyWalletClient } from "@/app/components/loyalty/loyalty-wallet-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.walletTitle")} · Menu Platform` };
}

export default async function LoyaltyWalletPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <LoyaltyWalletClient />
    </div>
  );
}
