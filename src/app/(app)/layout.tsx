import type { ReactNode } from "react";
import { BottomNav, MobileHeader, Sidebar } from "@/components/nav";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Redirects to /login when there's no valid session, so no app route
  // can render for an unauthenticated visitor.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={user.name} userPhone={user.phone} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:max-w-4xl md:px-8 md:pb-16 md:pt-6">
          <MobileHeader userName={user.name} userPhone={user.phone} />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
