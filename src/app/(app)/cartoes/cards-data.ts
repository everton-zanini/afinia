import "server-only";
import type { HouseholdContext } from "@/server/households/context";
import { listCategories } from "@/server/finance/categories";
import { getCardDetail } from "@/server/finance/cards";
import type { KnownInvoice } from "./invoice-choice";

/** Dados comuns dos formulários de compra: dias do cartão, limite disponível e faturas já criadas. */
export async function loadPurchaseContext(ctx: HouseholdContext, cardId: string, today: string, keepCategoryId?: string | null) {
  const [detail, categories] = await Promise.all([
    getCardDetail(ctx, cardId, null, today),
    listCategories(ctx, { includeArchived: true }),
  ]);
  const known: KnownInvoice[] = detail.invoices.map((i) => ({
    id: i.id,
    periodStart: i.periodStart,
    closingDate: i.closingDate,
    dueDate: i.dueDate,
    paid: i.status.payment === "paid",
  }));
  return {
    card: detail.card,
    common: {
      cardId,
      cardName: detail.card.name,
      cardDays: { closingDay: detail.card.closingDay, dueDay: detail.card.dueDay },
      availableCents: detail.card.limit.availableCents,
      known,
      today,
    },
    categories: categories
      .filter((c) => c.kind === "EXPENSE" && (!c.archived || c.id === keepCategoryId))
      .map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    members: ctx.members.map((m) => ({ memberId: m.memberId, name: m.name })),
  };
}
