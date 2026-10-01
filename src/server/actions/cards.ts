"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cardSchema, confirmForecastSchema, invoicePaymentSchema, purchaseSchema } from "@/lib/validation/cards";
import { type ActionState, formToObject, invalidInput, toActionError } from "@/server/action-result";
import { requireHousehold } from "@/server/session";
import * as cards from "@/server/finance/cards";

// Ações finas: sessão → contexto do casal → validação → serviço. Nenhum householdId vem do formulário.

const idSchema = z.string().min(1).max(64);

function refreshFinance() {
  revalidatePath("/", "layout");
}

export async function saveCardAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = cardSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  let targetId: string;
  try {
    if (id) {
      targetId = idSchema.parse(id);
      await cards.updateCard(ctx, targetId, parsed.data);
    } else {
      targetId = (await cards.createCard(ctx, parsed.data)).id;
    }
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect(`/cartoes/${targetId}?salvo=${id ? "cartao" : "novo"}`);
}

export async function archiveCardAction(id: string, archived: boolean): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await cards.setCardArchived(ctx, idSchema.parse(id), archived);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: archived ? "Cartão arquivado." : "Cartão reativado." };
}

export async function savePurchaseAction(purchaseId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = purchaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    if (purchaseId) {
      const id = idSchema.parse(purchaseId);
      await cards.updatePurchase(ctx, id, parsed.data);
      refreshFinance();
      redirect(`/cartoes/compras/${id}?salvo=1`);
    }
    const result = await cards.createPurchase(ctx, parsed.data);
    refreshFinance();
    redirect(`/cartoes/${parsed.data.cardId}?salvo=compra${result.overLimit ? "&acima=1" : ""}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePurchaseAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  let cardId: string;
  try {
    const purchaseId = idSchema.parse(id);
    cardId = (await cards.getPurchase(ctx, purchaseId)).cardId;
    await cards.deletePurchase(ctx, purchaseId);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect(`/cartoes/${cardId}?salvo=excluida`);
}

export async function moveInstallmentAction(installmentId: string, invoiceId: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await cards.moveInstallment(ctx, idSchema.parse(installmentId), idSchema.parse(invoiceId));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: "Parcela remanejada." };
}

export async function payInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = invoicePaymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await cards.payInvoice(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: "Pagamento registrado." };
}

export async function undoPaymentAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await cards.undoPayment(ctx, idSchema.parse(id));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: "Pagamento desfeito." };
}

export async function confirmForecastAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = confirmForecastSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  let cardId: string;
  try {
    const forecastId = idSchema.parse(id);
    const forecast = await cards.getForecast(ctx, forecastId).catch(() => null);
    await cards.confirmForecast(ctx, forecastId, parsed.data);
    cardId = forecast?.cardId ?? (await cards.getPurchase(ctx, forecastId)).cardId;
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect(`/cartoes/${cardId}?salvo=confirmada`);
}

export async function skipForecastAction(id: string, scope: "only" | "following"): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await cards.skipForecast(ctx, idSchema.parse(id), scope === "following" ? "following" : "only");
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: scope === "following" ? "Cobranças seguintes removidas." : "Cobrança removida." };
}
