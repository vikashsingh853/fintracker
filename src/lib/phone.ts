/**
 * Phone helpers shared by server actions and client components, so this
 * module deliberately stays free of server-only imports.
 */

/**
 * Normalises Indian mobile input to bare 10 digits so that
 * "+91 98765 43210", "09876543210" and "9876543210" are one account.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  const local =
    digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith("0") && digits.length === 11
        ? digits.slice(1)
        : digits;

  // Indian mobile numbers are 10 digits starting with 6-9.
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export function formatPhoneClient(phone: string): string {
  return phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}
