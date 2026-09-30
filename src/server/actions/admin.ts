"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createHouseholdSchema,
  participantSchema,
  resetPasswordSchema,
} from "@/lib/validation/admin";
import { type ActionState, formToObject, invalidInput, toActionError } from "@/server/action-result";
import { requireAdmin } from "@/server/session";
import * as admin from "@/server/services/admin";

const idSchema = z.string().min(1).max(64);

function participantsFromForm(raw: Record<string, string>) {
  const out: { name: string; email: string; password: string }[] = [];
  for (const i of [1, 2]) {
    const name = raw[`p${i}.name`]?.trim() ?? "";
    const email = raw[`p${i}.email`]?.trim() ?? "";
    const password = raw[`p${i}.password`] ?? "";
    if (name || email || password) out.push({ name, email, password });
  }
  return out;
}

export async function createHouseholdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const raw = formToObject(formData);
  const parsed = createHouseholdSchema.safeParse({
    name: raw.name,
    includeMe: raw.includeMe === "on",
    participants: participantsFromForm(raw),
  });
  if (!parsed.success) {
    // Reindexa erros "participants.0.email" → "p1.email" para os campos do formulário.
    const state = invalidInput(parsed.error);
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(state.fieldErrors ?? {})) {
      const m = k.match(/^participants\.(\d)\.(\w+)$/);
      fieldErrors[m ? `p${Number(m[1]) + 1}.${m[2]}` : k] = v;
    }
    return { ...state, fieldErrors };
  }
  if (parsed.data.includeMe && (await admin.adminHasHousehold(user.id))) {
    return { ok: false, message: "Você já participa de um casal." };
  }
  let householdId: string;
  try {
    householdId = (await admin.createHousehold(user.id, parsed.data)).id;
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/admin");
  redirect(`/admin/casais/${householdId}?criado=1`);
}

export async function addParticipantAction(
  householdId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.parse(householdId);
  const parsed = participantSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await admin.addParticipant(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/admin/casais/${id}`);
  return { ok: true, message: "Participante adicionado. Informe a senha temporária a ele." };
}

export async function setHouseholdActiveAction(householdId: string, active: boolean) {
  await requireAdmin();
  await admin.setHouseholdActive(idSchema.parse(householdId), active);
  revalidatePath(`/admin/casais/${householdId}`);
  revalidatePath("/admin");
}

export async function resetPasswordAction(
  householdId: string,
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await admin.resetParticipantPassword(idSchema.parse(householdId), idSchema.parse(userId), parsed.data.password);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/admin/casais/${householdId}`);
  return { ok: true, message: "Senha temporária definida. As sessões dessa pessoa foram encerradas." };
}
