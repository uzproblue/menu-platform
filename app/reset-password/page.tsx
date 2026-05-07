import type { Metadata } from "next";
import Link from "next/link";
import { PlatformBackground } from "../components/platform-background";
import { ResetPasswordForm } from "./reset-password-form";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Reset password · Menu Platform",
  description: "Set a new password for your Menu Platform account",
};

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { t } = await getServerT();
  const { token } = await searchParams;
  const raw = typeof token === "string" ? token.trim() : "";

  return (
    <div className="relative min-h-screen overflow-hidden font-sans">
      <PlatformBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
              {t("common.appName")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {t("reset.title")}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">{t("reset.subtitle")}</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
            {!raw.length ? (
              <div className="space-y-5">
                <p
                  className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2.5 text-sm text-foreground/80"
                  role="status"
                >
                  {t("reset.invalidToken")}
                </p>
                <Link
                  href="/forgot-pass"
                  className="flex w-full items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  {t("forgot.title")}
                </Link>
              </div>
            ) : (
              <ResetPasswordForm token={raw} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
