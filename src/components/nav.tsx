"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookUser,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { AccountMenu } from "./account-menu";
import { LogoTile } from "./logo";
import { NavPending } from "./nav-pending";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: Receipt },
  { href: "/khata", label: "Khata", icon: BookUser },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/recurring", label: "Bills", icon: CalendarClock },
  { href: "/accounts", label: "Accounts", icon: Wallet },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-surface/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex flex-col items-center gap-0.5 px-0.5 py-2 text-[9.5px] font-medium transition-colors",
                  active ? "text-brand-600" : "text-ink-500",
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                <span className="w-full truncate text-center">{label}</span>
                <NavPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ userName, userPhone }: { userName: string; userPhone: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-surface md:block">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-6">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <LogoTile />
          <span>
            <span className="block text-sm font-semibold leading-tight text-ink-900">FinTrack</span>
            <span className="block text-[11px] leading-tight text-ink-500">
              Know your money
            </span>
          </span>
        </Link>

        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
                  {label}
                  <NavPending />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-medium text-ink-500">Theme</span>
            <ThemeToggle placement="top" />
          </div>
          <AccountMenu name={userName} phone={userPhone} />
        </div>
      </div>
    </aside>
  );
}

/** Mobile top bar — shows who's signed in and offers sign out. */
export function MobileHeader({ userName, userPhone }: { userName: string; userPhone: string }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <LogoTile className="h-8 w-8 rounded-lg" iconClassName="h-[18px] w-[18px]" />
        <span className="text-sm font-semibold text-ink-900">FinTrack</span>
      </Link>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <AccountMenu name={userName} phone={userPhone} compact />
      </div>
    </header>
  );
}
