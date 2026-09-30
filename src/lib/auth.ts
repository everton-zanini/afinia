import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { clearLoginFailures, isLoginLocked, registerLoginFailure } from "@/server/login-throttle";
import { assertLoginAllowed } from "@/server/login-policy";

export const LOCKED_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";

function emailFromBody(body: unknown): string | null {
  if (body && typeof body === "object" && "email" in body && typeof body.email === "string") {
    return body.email;
  }
  return null;
}

export const auth = betterAuth({
  appName: "Afinia",
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      isPlatformAdmin: { type: "boolean", defaultValue: false, input: false },
      mustChangePassword: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
  databaseHooks: {
    session: {
      create: {
        // Bloqueia sessões de usuários sem acesso (ex.: casal desativado).
        before: async (session) => {
          await assertLoginAllowed(session.userId);
          return { data: session };
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailFromBody(ctx.body);
      if (email && (await isLoginLocked(email))) {
        throw new APIError("TOO_MANY_REQUESTS", { message: LOCKED_MESSAGE });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailFromBody(ctx.body);
      if (!email) return;
      const returned = ctx.context.returned;
      if (isAPIError(returned)) {
        if (returned.status === "UNAUTHORIZED") await registerLoginFailure(email);
      } else if (ctx.context.newSession) {
        await clearLoginFailures(email);
      }
    }),
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
