import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { SettingsPageClient } from "@/app/components/settings/settings-page-client";

export const metadata: Metadata = {
  title: "Settings · Menu Platform",
  description: "Manage profile, password, and team invites",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const initialName = session?.user?.name?.trim() || "User";
  const initialEmail = session?.user?.email ?? null;

  return (
    <SettingsPageClient initialName={initialName} initialEmail={initialEmail} />
  );
}
