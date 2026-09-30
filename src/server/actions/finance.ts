"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  accountSchema,
  budgetLimitSchema,
  categorySchema,
  isoDate,
  isoMonth,
  transactionSchema,
} from "@/lib/validation/finance";
import { type ActionState, formToObject, invalidInput, toActionError } from "@/server/action-result";
import { requireHousehold } from "@/server/session";
import * as accounts from "@/server/finance/accounts";
import * as categories from "@/server/finance/categories";
import * as transactions from "@/server/finance/transactions";
import * as budgets from "@/server/finance/budgets";

// Ações finas: sessão → contexto do casal → validação → serviço. Nenhum householdId vem do formulário.

const idSchema = z.string().min(1).max(64);

function refreshFinance() {
  revalidatePath("/", "layout");
}

// ---------- Categorias ----------

export async function saveCategoryAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    if (id) await categories.updateCategory(ctx, idSchema.parse(id), parsed.data);
    else await categories.createCategory(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect("/mais/categorias");
}

export async function archiveCategoryAction(id: string, archived: boolean): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await categories.setCategoryArchived(ctx, idSchema.parse(id), archived);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: archived ? "Categoria arquivada." : "Categoria reativada." };
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await categories.deleteCategory(ctx, idSchema.parse(id));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect("/mais/categorias");
}

// ---------- Contas ----------

export async function saveAccountAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = accountSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    if (id) await accounts.updateAccount(ctx, idSchema.parse(id), parsed.data);
    else await accounts.createAccount(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect("/mais/contas");
}

export async function archiveAccountAction(id: string, archived: boolean): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await accounts.setAccountArchived(ctx, idSchema.parse(id), archived);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: archived ? "Conta arquivada." : "Conta reativada." };
}

export async function deleteAccountAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await accounts.deleteAccount(ctx, idSchema.parse(id));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect("/mais/contas");
}

// ---------- Lançamentos ----------

export async function saveTransactionAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = transactionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  let targetId: string;
  try {
    if (id) {
      targetId = idSchema.parse(id);
      await transactions.updateTransaction(ctx, targetId, parsed.data);
    } else {
      targetId = (await transactions.createTransaction(ctx, parsed.data)).id;
    }
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect(id ? `/lancamentos/${targetId}?salvo=1` : `/lancamentos?salvo=1`);
}

export async function markEffectiveAction(id: string, date: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsedDate = isoDate.safeParse(date);
  if (!parsedDate.success) return { ok: false, message: "Informe uma data válida" };
  try {
    await transactions.markEffective(ctx, idSchema.parse(id), parsedDate.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: "Lançamento marcado como efetivado." };
}

export async function markPendingAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await transactions.markPending(ctx, idSchema.parse(id));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: "Lançamento voltou para pendente." };
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  try {
    await transactions.deleteTransaction(ctx, idSchema.parse(id));
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  redirect("/lancamentos?excluido=1");
}

// ---------- Orçamento ----------

export async function setBudgetLimitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = budgetLimitSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await budgets.setBudgetLimit(ctx, parsed.data.month, parsed.data.categoryId, parsed.data.limit);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return { ok: true, message: parsed.data.limit === null ? "Limite removido." : "Limite salvo." };
}

export async function copyPreviousBudgetAction(month: string): Promise<ActionState> {
  const { ctx } = await requireHousehold();
  const parsed = isoMonth.safeParse(month);
  if (!parsed.success) return { ok: false, message: "Mês inválido" };
  let count: number;
  try {
    count = await budgets.copyPreviousMonth(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshFinance();
  return {
    ok: true,
    message: count === 0 ? "Nada novo para copiar do mês anterior." : `${count} limite(s) copiado(s) do mês anterior.`,
  };
}
