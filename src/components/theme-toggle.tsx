"use client";

import clsx from "clsx";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export const THEME_STORAGE_KEY = "fintrack-theme";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Runs before paint to apply the stored preference, preventing a flash of the
 * wrong theme. Kept as a string so it can be inlined in <head>.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

const THEME_EVENT = "fintrack:theme-change";

function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = preference === "dark" || (preference === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/*
 * The preference lives in localStorage, so it is read as an external store
 * rather than mirrored into component state.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function getSnapshot(): ThemePreference {
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null) ?? "system";
}

/** The server can't know the preference, so it renders the neutral default. */
function getServerSnapshot(): ThemePreference {
  return "system";
}

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({
  className,
  align = "right",
  placement = "bottom",
}: {
  className?: string;
  /** Which edge the menu lines up with, so it never runs off screen. */
  align?: "left" | "right";
  /** Open upward when the trigger sits near the bottom of the viewport. */
  placement?: "top" | "bottom";
}) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const active = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2];
  const ActiveIcon = active.icon;

  // Close on outside click or Escape, and return focus to the trigger.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
    setOpen(false);
  }, []);

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${active.label}`}
        title={`Theme: ${active.label}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
      >
        <ActiveIcon size={15} strokeWidth={2} />
        <ChevronDown
          size={13}
          className={clsx("text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Colour theme"
          className={clsx(
            "animate-sheet absolute z-50 w-40 overflow-hidden rounded-xl border border-ink-200 bg-surface p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = preference === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => choose(value)}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition",
                  selected
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-700 hover:bg-ink-100",
                )}
              >
                <Icon size={15} strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
