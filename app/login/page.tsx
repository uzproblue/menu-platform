import type { Metadata } from "next";
import { PlatformBackground } from "../components/platform-background";
import { LoginForm } from "./login-form";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Sign in · Menu Platform",
  description: "Sign in to your Menu Platform account",
};

export default async function LoginPage() {
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
              {t("login.welcomeBack")}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">
              {t("login.continueText")}
            </p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
