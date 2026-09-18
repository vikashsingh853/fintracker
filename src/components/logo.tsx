import type { SVGProps } from "react";

/**
 * FinTrack mark: a "V" fused with the rupee sign.
 *
 * The V's arms rise above two horizontal bars, so the shape reads as a V and
 * as ₹ at the same time. Drawn as strokes on a 100×100 grid; the PNG app
 * icons in public/icons are generated from these exact coordinates.
 */
export function Logo({
  title = "FinTrack",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth={11}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M26 18 L50 86 L74 18" />
      <path d="M20 30 H80" />
      <path d="M20 50 H80" />
    </svg>
  );
}

/** The mark inside its brand-coloured tile, as used in headers. */
export function LogoTile({
  className = "h-9 w-9",
  iconClassName = "h-5 w-5",
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-brand-600 text-white ${className}`}
    >
      <Logo className={iconClassName} />
    </span>
  );
}
