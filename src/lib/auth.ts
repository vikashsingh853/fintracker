import "server-only";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { normalisePhone } from "./phone";

export { normalisePhone };

export const SESSION_COOKIE = "fintrack_session";

const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

function expiryDate() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string, userAgent?: string) {
  const session = await prisma.session.create({
    data: { userId, expiresAt: expiryDate(), userAgent: userAgent ?? null },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  return session;
}

export async function destroySession() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    // deleteMany avoids throwing when the row is already gone.
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
  store.delete(SESSION_COOKIE);
}

/** Resolves the signed-in user, or null. Expired sessions are cleaned up. */
export async function getSessionUser() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.user;
}
