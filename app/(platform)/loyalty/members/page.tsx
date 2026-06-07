import type { Metadata } from "next";
import { LoyaltyMembersClient } from "@/app/components/loyalty/loyalty-members-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.membersTitle")} · Menu Platform` };
}

export default async function LoyaltyMembersPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("loyalty.membersTitle")}</h1>
        <p className="mt-2 text-sm text-foreground/60">{t("loyalty.membersSubtitle")}</p>
        <div className="mt-8">
          <LoyaltyMembersClient />
        </div>
      </div>
    </div>
  );
}
