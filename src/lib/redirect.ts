/** Only same-origin paths are allowed, so `?next=` can't become an open redirect. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return "/";
  return value;
}
