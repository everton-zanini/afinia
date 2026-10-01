import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHouseholdContext, type HouseholdContext } from "@/server/households/context";
import { ensureGenerated } from "@/server/finance/recurrences";

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

/** Contexto do casal do usuário da sessão, memoizado por requisição. */
export const getCurrentHousehold = cache(async (userId: string) => getHouseholdContext(userId));

/** Exige usuário com vínculo ativo em casal ativo. Todas as páginas/ações financeiras usam isto. */
export async function requireHousehold() {
  const session = await requireUser();
  const ctx = await getCurrentHousehold(session.user.id);
  if (!ctx) redirect("/sem-casal");
  await ensureRecurrences(ctx);
  return { ...session, ctx };
}

/**
 * Materializa a janela das recorrências uma vez por requisição (sem tarefa agendada).
 * O contexto vem de getCurrentHousehold (memoizado), então é o mesmo objeto na requisição.
 */
const ensureRecurrences = cache(async (ctx: HouseholdContext) => {
  await ensureGenerated(ctx);
});

/** Exige administrador da plataforma; para os demais, a rota simplesmente não existe. */
export async function requireAdmin() {
  const session = await requireUser();
  if (!session.user.isPlatformAdmin) notFound();
  return session;
}
