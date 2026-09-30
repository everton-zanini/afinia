import { APIError } from "better-auth/api";
import { db } from "@/server/db";

export const ACCESS_DISABLED_MESSAGE = "Acesso desativado. Fale com o administrador.";

/** Regras de acesso avaliadas sempre que uma sessão é criada. */
export async function assertLoginAllowed(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new APIError("FORBIDDEN", { message: ACCESS_DISABLED_MESSAGE });
}
