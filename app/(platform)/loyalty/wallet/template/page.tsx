import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { LoyaltyWalletTemplateClient } from "@/app/components/loyalty/loyalty-wallet-template-client";
import { authOptions } from "@/lib/auth-options";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.walletTemplateTitle")} · Menu Platform` };
}

export default async function LoyaltyWalletTemplatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isOwner) {
    redirect("/loyalty/wallet");
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <LoyaltyWalletTemplateClient />
    </div>
  );
}
