import type { ReactNode } from "react";
import { LogoTile } from "./logo";
import { ThemeToggle } from "./theme-toggle";

/** Shared shell for the login and signup screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoTile
            className="mx-auto mb-4 h-14 w-14 rounded-2xl shadow-lg shadow-brand-600/25"
            iconClassName="h-8 w-8"
          />
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
        </div>

        <div className="animate-rise rounded-2xl border border-ink-200/80 bg-surface p-5 shadow-sm sm:p-6">
          {children}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-400">
          FinTrack — know your money, plan your future.
        </p>
      </div>
    </div>
  );
}
