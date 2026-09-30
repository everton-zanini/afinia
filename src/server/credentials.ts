import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

// Operações de credencial feitas pelo servidor (bootstrap e administrador), fora do cadastro
// público — que está desabilitado. Usa o mesmo hash (scrypt) do Better Auth.

const CREDENTIAL_PROVIDER = "credential";

type Tx = Prisma.TransactionClient;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createCredentialUser(
  input: {
    name: string;
    email: string;
    password: string;
    isPlatformAdmin?: boolean;
    mustChangePassword?: boolean;
  },
  tx: Tx = db,
) {
  const id = randomUUID();
  const hash = await hashPassword(input.password);
  return tx.user.create({
    data: {
      id,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      emailVerified: false,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
      mustChangePassword: input.mustChangePassword ?? true,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: CREDENTIAL_PROVIDER, password: hash },
      },
    },
  });
}

export async function verifyUserPassword(userId: string, password: string) {
  const account = await db.account.findFirst({
    where: { userId, providerId: CREDENTIAL_PROVIDER },
    select: { password: true },
  });
  if (!account?.password) return false;
  return verifyPassword({ hash: account.password, password });
}

/** Define senha temporária: exige troca no próximo acesso e revoga todas as sessões do usuário. */
export async function setTemporaryPassword(userId: string, password: string) {
  const hash = await hashPassword(password);
  await db.$transaction([
    db.account.updateMany({
      where: { userId, providerId: CREDENTIAL_PROVIDER },
      data: { password: hash },
    }),
    db.user.update({ where: { id: userId }, data: { mustChangePassword: true } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}
