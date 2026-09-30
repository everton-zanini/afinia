"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAPIError } from "better-auth/api";
import { auth, LOCKED_MESSAGE } from "@/lib/auth";
import { ACCESS_DISABLED_MESSAGE } from "@/server/login-policy";
import {
  emailChangeSchema,
  loginSchema,
  nameSchema,
  passwordChangeSchema,
} from "@/lib/validation/auth";
import {
  type ActionState,
  formToObject,
  invalidInput,
  toActionError,
} from "@/server/action-result";
import { requireUser } from "@/server/session";
import * as profile from "@/server/services/profile";

const INVALID_CREDENTIALS = "Email ou senha inválidos";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: INVALID_CREDENTIALS };
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      if (error.status === "TOO_MANY_REQUESTS") return { ok: false, message: LOCKED_MESSAGE };
      if (error.status === "FORBIDDEN") return { ok: false, message: ACCESS_DISABLED_MESSAGE };
      return { ok: false, message: INVALID_CREDENTIALS };
    }
    return toActionError(error);
  }
  redirect("/inicio");
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function updateNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = nameSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await profile.updateName(user.id, parsed.data.name);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Nome atualizado." };
}

export async function updateEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = emailChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await profile.updateEmail(user.id, parsed.data.email, parsed.data.currentPassword);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Email atualizado. Use o novo email no próximo login." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, sessionId } = await requireUser({ allowTemporaryPassword: true });
  const parsed = passwordChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await profile.changePassword({
      userId: user.id,
      currentSessionId: sessionId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  } catch (error) {
    return toActionError(error);
  }
  if (user.mustChangePassword) redirect("/inicio");
  return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
}
