/**
 * All money in FinTrack is an integer number of paise.
 * Floating point rupees are never stored or summed — only formatted.
 */

export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}


const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});


/** "₹1,24,250" — drops paise when they are zero, for dashboard tiles. */
export function formatINRCompact(paise: number): string {
  const rupees = paiseToRupees(paise);
  return Number.isInteger(rupees) ? inrWholeFormatter.format(rupees) : inrFormatter.format(rupees);
}

/** "₹1.24L" / "₹18.4Cr" — for tight mobile tiles. */
export function formatINRShort(paise: number): string {
  const rupees = Math.abs(paiseToRupees(paise));
  const sign = paise < 0 ? "-" : "";
  const group = (n: number, digits: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);

  if (rupees >= 10_000_000) {
    const crore = rupees / 10_000_000;
    // Beyond four digits of crore, decimals are noise.
    return `${sign}₹${group(crore, crore >= 1_000 ? 0 : 2)} Cr`;
  }
  if (rupees >= 100_000) return `${sign}₹${group(rupees / 100_000, 2)} L`;
  if (rupees >= 1_000) return `${sign}₹${group(rupees / 1_000, 1)} K`;
  return `${sign}₹${group(rupees, 0)}`;
}

/**
 * Full rupee formatting until the string gets long enough to break a tile,
 * then falls back to lakh/crore notation. Keeps normal amounts precise while
 * guaranteeing an unusually large value can never blow out the layout.
 */
export function formatINRAdaptive(paise: number, threshold = 10_000_000): string {
  return Math.abs(paiseToRupees(paise)) >= threshold
    ? formatINRShort(paise)
    : formatINRCompact(paise);
}



/** Converts Prisma BigInt paise into a plain number at the data-layer boundary. */
export function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}
