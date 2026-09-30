import { APIError } from "better-auth/api";
import { db } from "@/server/db";

export const ACCESS_DISABLED_MESSAGE = "Acesso desativado. Fale com o administrador.";

/**
 * Regras de acesso avaliadas sempre que uma sessão é criada: administrador da plataforma ou
 * participante ativo de um casal ativo.
 */
export async function isLoginAllowed(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      membership: { select: { active: true, household: { select: { active: true } } } },
    },
  });
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return !!user.membership?.active && user.membership.household.active;
}

export async function assertLoginAllowed(userId: string) {
  if (!(await isLoginAllowed(userId))) {
    throw new APIError("FORBIDDEN", { message: ACCESS_DISABLED_MESSAGE });
  }
}
