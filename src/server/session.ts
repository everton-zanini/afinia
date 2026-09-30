import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
};

/** Sessão validada no banco (sem cache de cookie). Memoizada por requisição. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  const user: SessionUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
    mustChangePassword: Boolean(u.mustChangePassword),
  };
  return { user, sessionId: session.session.id };
});

/**
 * Exige usuário autenticado. Redireciona para o login sem sessão e para a troca de senha
 * quando a senha ainda é temporária (exceto na própria tela de troca).
 */
export async function requireUser(opts: { allowTemporaryPassword?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword && !opts.allowTemporaryPassword) redirect("/definir-senha");
  return session;
}
