import { z } from "zod";
import { db } from "@/server/db";
import { createCredentialUser, normalizeEmail } from "@/server/credentials";
import { addMember } from "@/server/households/members";
import { onHouseholdCreated } from "@/server/households/setup";

const bootstrapEnvSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.email("BOOTSTRAP_ADMIN_EMAIL inválido"),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1, "BOOTSTRAP_ADMIN_NAME é obrigatório"),
  BOOTSTRAP_ADMIN_PASSWORD: z
    .string("BOOTSTRAP_ADMIN_PASSWORD é obrigatório")
    .min(12, "BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres"),
});

export type BootstrapResult = { userId: string; created: boolean; householdCreated: boolean };

/**
 * Cria o administrador da plataforma. Idempotente: se o email já existe, apenas garante a
 * condição de administrador — nunca altera senha, nome ou outros dados.
 */
export async function runBootstrap(env: Record<string, string | undefined>): Promise<BootstrapResult> {
  const parsed = bootstrapEnvSchema.safeParse({
    BOOTSTRAP_ADMIN_EMAIL: env.BOOTSTRAP_ADMIN_EMAIL || undefined,
    BOOTSTRAP_ADMIN_NAME: env.BOOTSTRAP_ADMIN_NAME || undefined,
    BOOTSTRAP_ADMIN_PASSWORD: env.BOOTSTRAP_ADMIN_PASSWORD || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD } = parsed.data;
  const email = normalizeEmail(BOOTSTRAP_ADMIN_EMAIL);

  let userId: string;
  let created = false;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    userId = existing.id;
    if (!existing.isPlatformAdmin) {
      await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
    }
  } else {
    const user = await createCredentialUser({
      name: BOOTSTRAP_ADMIN_NAME,
      email,
      password: BOOTSTRAP_ADMIN_PASSWORD,
      isPlatformAdmin: true,
      mustChangePassword: true,
    });
    userId = user.id;
    created = true;
  }

  const householdName = env.BOOTSTRAP_HOUSEHOLD_NAME?.trim();
  let householdCreated = false;
  if (householdName) {
    const membership = await db.householdMember.findUnique({ where: { userId }, select: { id: true } });
    if (!membership) {
      await db.$transaction(async (tx) => {
        const household = await tx.household.create({ data: { name: householdName } });
        await addMember(tx, household.id, userId);
        await onHouseholdCreated(tx, household.id);
      });
      householdCreated = true;
    }
  }
  return { userId, created, householdCreated };
}
