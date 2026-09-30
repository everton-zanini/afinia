"use client";

import { useActionState, useState } from "react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createHouseholdAction } from "@/server/actions/admin";
import { TempPasswordField } from "../../temp-password-field";

export function NewHouseholdForm({ canJoin, adminName }: { canJoin: boolean; adminName: string }) {
  const [state, action] = useActionState(createHouseholdAction, { ok: false });
  const [includeMe, setIncludeMe] = useState(false);
  const e = state.fieldErrors ?? {};
  const slots = includeMe ? [2] : [1, 2];

  return (
    <ActionForm action={action} className="grid gap-4">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field label="Nome do casal" name="name" placeholder="Ex.: Casa Silva" error={e.name} />
        {canJoin && (
          <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
            <Checkbox
              id="includeMe"
              name="includeMe"
              checked={includeMe}
              onCheckedChange={(v) => setIncludeMe(v === true)}
              className="mt-0.5 size-5"
            />
            <Label htmlFor="includeMe" className="grid gap-0.5 font-normal leading-snug">
              <span className="font-medium">Eu participo deste casal</span>
              <span className="text-sm text-muted-foreground">{adminName} será um dos dois participantes.</span>
            </Label>
          </div>
        )}
      </section>

      {slots.map((i, idx) => (
        <fieldset key={i} className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <legend className="sr-only">Participante {idx + 1}</legend>
          <p aria-hidden className="font-semibold">
            {includeMe ? "Outro participante (opcional)" : idx === 0 ? "Participante 1" : "Participante 2 (opcional)"}
          </p>
          <Field label="Nome" name={`p${i}.name`} autoComplete="off" error={e[`p${i}.name`]} />
          <Field label="Email" name={`p${i}.email`} type="email" inputMode="email" autoComplete="off" error={e[`p${i}.email`]} />
          <TempPasswordField name={`p${i}.password`} error={e[`p${i}.password`]} />
        </fieldset>
      ))}

      <FormMessage ok={state.ok} message={e.participants ?? state.message} />
      <SubmitButton size="lg" pendingLabel="Cadastrando…">
        Cadastrar casal
      </SubmitButton>
    </ActionForm>
  );
}
