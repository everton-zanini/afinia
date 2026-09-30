import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { normalizeEmail, verifyUserPassword } from "@/server/credentials";
import { DomainError } from "@/server/errors";

export async function updateName(userId: string, name: string) {
  await db.user.update({ where: { id: userId }, data: { name: name.trim() } });
}

export async function updateEmail(userId: string, email: string, currentPassword: string) {
  if (!(await verifyUserPassword(userId, currentPassword))) {
    throw new DomainError("Senha atual incorreta", "currentPassword");
  }
  const normalized = normalizeEmail(email);
  const taken = await db.user.findFirst({
    where: { email: normalized, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) throw new DomainError("Este email já está em uso", "email");
  await db.user.update({ where: { id: userId }, data: { email: normalized } });
}

/**
 * Troca a senha exigindo a senha atual. Revoga todas as outras sessões do usuário, mantendo a
 * sessão corrente, e encerra a obrigação de troca de senha temporária.
 */
export async function changePassword(input: {
  userId: string;
  currentSessionId: string;
  currentPassword: string;
  newPassword: string;
}) {
  if (!(await verifyUserPassword(input.userId, input.currentPassword))) {
    throw new DomainError("Senha atual incorreta", "currentPassword");
  }
  if (input.newPassword === input.currentPassword) {
    throw new DomainError("A nova senha deve ser diferente da atual", "newPassword");
  }
  const hash = await hashPassword(input.newPassword);
  await db.$transaction([
    db.account.updateMany({
      where: { userId: input.userId, providerId: "credential" },
      data: { password: hash },
    }),
    db.user.update({ where: { id: input.userId }, data: { mustChangePassword: false } }),
    db.session.deleteMany({ where: { userId: input.userId, NOT: { id: input.currentSessionId } } }),
  ]);
}
