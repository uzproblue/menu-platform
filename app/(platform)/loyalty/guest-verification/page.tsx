import type { Metadata } from "next";
import { LoyaltyGuestVerificationClient } from "@/app/components/loyalty/loyalty-guest-verification-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.guestVerificationTitle")} · Menu Platform` };
}

export default async function LoyaltyGuestVerificationPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <LoyaltyGuestVerificationClient />
    </div>
  );
}
