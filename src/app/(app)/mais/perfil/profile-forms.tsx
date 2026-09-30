"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { updateEmailAction, updateNameAction } from "@/server/actions/auth";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateNameAction, { ok: false });
  return (
    <form action={action} className="grid gap-3" noValidate>
      <Field label="Seu nome" name="name" defaultValue={name} autoComplete="name" error={state.fieldErrors?.name} />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton>Salvar nome</SubmitButton>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState(updateEmailAction, { ok: false });
  return (
    <form action={action} className="grid gap-3" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        defaultValue={email}
        autoComplete="email"
        error={state.fieldErrors?.email}
      />
      <Field
        label="Senha atual"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton>Salvar email</SubmitButton>
    </form>
  );
}
