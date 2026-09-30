"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionState } from "@/server/action-result";
import { CopyPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { centsToInput } from "@/lib/money";
import { copyPreviousBudgetAction, setBudgetLimitAction } from "@/server/actions/finance";

export function LimitEditor({
  month,
  categoryId,
  name,
  limitCents,
}: {
  month: string;
  categoryId: string;
  name: string;
  limitCents: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await setBudgetLimitAction(prev, formData);
    if (result.ok) {
      setOpen(false);
      if (result.message) toast.success(result.message);
    }
    return result;
  }, { ok: false });

  if (!open) {
    return (
      <Button variant="ghost" className="justify-self-start px-2 text-primary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        {limitCents === null ? "Definir limite" : "Alterar limite"}
      </Button>
    );
  }
  const inputId = `limit-${categoryId}`;
  return (
    <ActionForm action={action} className="grid gap-2">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <label htmlFor={inputId} className="text-sm font-medium">Limite de {name} (R$)</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          name="limit"
          inputMode="decimal"
          autoFocus
          defaultValue={limitCents ? centsToInput(limitCents) : ""}
          placeholder="0,00"
          aria-invalid={state.fieldErrors?.limit ? true : undefined}
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base"
        />
        <SubmitButton className="w-auto">Salvar</SubmitButton>
      </div>
      {state.fieldErrors?.limit && <FieldError>{state.fieldErrors.limit}</FieldError>}
      {!state.ok && state.message && !state.fieldErrors && <FieldError>{state.message}</FieldError>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        {limitCents !== null && (
          <p className="self-center text-xs text-muted-foreground">Deixe vazio e salve para remover o limite.</p>
        )}
      </div>
    </ActionForm>
  );
}

export function CopyPreviousButton({ month }: { month: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await copyPreviousBudgetAction(month);
            if (r.message) (r.ok ? toast.success : toast.error)(r.message);
          } catch {
            toast.error("Não foi possível copiar. Verifique sua conexão.");
          }
        })
      }
    >
      <CopyPlus aria-hidden />
      Copiar limites do mês anterior
    </Button>
  );
}
