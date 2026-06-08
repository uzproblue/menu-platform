import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { AppHeader } from "../components/app-header";
import { AppSidebar } from "../components/app-sidebar";
import { PlatformBackground } from "../components/platform-background";
import { PlatformPageTracker } from "../components/platform-page-tracker";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;

  return (
    <div className="relative h-dvh min-h-0 overflow-hidden font-sans">
      <PlatformPageTracker />
      <PlatformBackground />
      <div className="relative z-10 flex h-full min-h-0">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader email={email} />
          <main className="flex-1 overflow-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 md:px-6 md:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
