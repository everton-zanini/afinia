"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, { ok: false });
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field
        key={state.data?.email}
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        defaultValue={state.data?.email}
        required
      />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
