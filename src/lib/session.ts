import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth";

/**
 * Memoised for the lifetime of one request. Nearly every query calls this to
 * scope itself to the signed-in user, so without `cache` a single page render
 * repeats the session lookup dozens of times.
 */
const loadSessionUser = cache(getSessionUser);

/**
 * Every query and mutation funnels through here, so an unauthenticated
 * request can never reach user-scoped data.
 */
export async function getCurrentUser() {
  const user = await loadSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}

/** Non-redirecting variant for pages that render for both states. */
export async function getOptionalUser() {
  return loadSessionUser();
}
