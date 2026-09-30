import type { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "@/server/errors";

export type ActionState<T = undefined> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};

export function formToObject(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) obj[key] = value;
  }
  return obj;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalidInput(error: z.ZodError): ActionState<never> {
  return { ok: false, message: "Revise os campos destacados.", fieldErrors: zodFieldErrors(error) };
}

/** Converte exceções em estado de formulário, preservando redirects do Next. */
export function toActionError(error: unknown): ActionState<never> {
  unstable_rethrow(error);
  if (error instanceof DomainError) {
    return {
      ok: false,
      message: error.message,
      fieldErrors: error.field ? { [error.field]: error.message } : undefined,
    };
  }
  console.error(error);
  return { ok: false, message: "Não foi possível concluir. Tente novamente." };
}
