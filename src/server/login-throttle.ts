import { db } from "@/server/db";

// Persistido no Postgres para valer entre instâncias serverless.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function throttleKey(email: string) {
  return email.trim().toLowerCase();
}

export async function isLoginLocked(email: string, now = new Date()) {
  const row = await db.loginThrottle.findUnique({ where: { key: throttleKey(email) } });
  return !!row?.lockedUntil && row.lockedUntil > now;
}

export async function registerLoginFailure(email: string, now = new Date()) {
  const key = throttleKey(email);
  await db.$transaction(async (tx) => {
    const row = await tx.loginThrottle.findUnique({ where: { key } });
    const windowExpired = !row || now.getTime() - row.windowStart.getTime() > LOGIN_WINDOW_MS;
    const failures = windowExpired ? 1 : row.failures + 1;
    const windowStart = windowExpired ? now : row.windowStart;
    const lockedUntil =
      failures >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_WINDOW_MS) : null;
    await tx.loginThrottle.upsert({
      where: { key },
      create: { key, failures, windowStart, lockedUntil },
      update: { failures, windowStart, lockedUntil },
    });
  });
}

export async function clearLoginFailures(email: string) {
  await db.loginThrottle.deleteMany({ where: { key: throttleKey(email) } });
}
