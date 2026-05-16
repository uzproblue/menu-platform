import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformBackground } from "@/app/components/platform-background";
import { isValidRestRegisterDateParam } from "@/lib/rest-register-date";
import { RestRegisterForm } from "./rest-register-form";

export const metadata: Metadata = {
  title: "Register restaurant · Menu Platform",
  description: "Manual restaurant provisioning",
};

type PageProps = {
  params: Promise<{ date: string }>;
};

export default async function RestRegisterPage({ params }: PageProps) {
  const { date } = await params;
  if (!isValidRestRegisterDateParam(date)) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans">
      <PlatformBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
              Menu Platform
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Register restaurant
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">
              Manual provisioning · today&apos;s link (UTC):{" "}
              <span className="font-mono text-foreground/80">{date}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
            <RestRegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
