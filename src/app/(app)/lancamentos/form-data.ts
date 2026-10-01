import "server-only";
import type { HouseholdContext } from "@/server/households/context";
import { listAccounts } from "@/server/finance/accounts";
import { listCategories } from "@/server/finance/categories";
import { listCards } from "@/server/finance/cards";
import { mostUsed } from "@/server/finance/transactions";

/**
 * Opções do formulário: somente categorias/contas ativas, mais as já usadas pelo lançamento
 * (mesmo arquivadas), para a edição não perder a referência.
 */
export async function loadFormOptions(ctx: HouseholdContext, keep: { categoryId?: string | null; accountIds?: (string | null)[] } = {}) {
  const [categories, accounts, suggestions, cards] = await Promise.all([
    listCategories(ctx, { includeArchived: true }),
    listAccounts(ctx, { includeArchived: true }),
    mostUsed(ctx),
    listCards(ctx),
  ]);
  const keepAccounts = new Set(keep.accountIds?.filter(Boolean) as string[]);
  return {
    categories: categories.filter((c) => !c.archived || c.id === keep.categoryId),
    accounts: accounts.filter((a) => !a.archived || keepAccounts.has(a.id)).map((a) => ({ id: a.id, name: a.name, benefit: a.kind === "BENEFIT" })),
    // Cartões ativos: destino possível de despesas recorrentes.
    cards: cards.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name })),
    members: ctx.members.map((m) => ({ memberId: m.memberId, name: m.name })),
    suggestedCategoryIds: suggestions.categoryIds,
    suggestedAccountIds: suggestions.accountIds,
  };
}
