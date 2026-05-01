import type { Metadata } from "next";
import { PlatformBackground } from "../components/platform-background";
import { ForgotPasswordForm } from "./forgot-password-form";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Forgot password · Menu Platform",
  description: "Reset your Menu Platform account password",
};

export default async function ForgotPasswordPage() {
  const { t } = await getServerT();
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
              {t("forgot.title")}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">
              {t("forgot.subtitle")}
            </p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
