"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { changePasswordAction } from "@/server/actions/auth";

export function PasswordForm({ temporary = false }: { temporary?: boolean }) {
  const [state, action] = useActionState(changePasswordAction, { ok: false });
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field
        label={temporary ? "Senha temporária" : "Senha atual"}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={e.currentPassword}
        required
      />
      <Field
        label="Nova senha"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
        error={e.newPassword}
        required
      />
      <Field
        label="Confirme a nova senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={e.confirmPassword}
        required
      />
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">{temporary ? "Definir senha e continuar" : "Alterar senha"}</SubmitButton>
      {!temporary && (
        <p className="text-sm text-muted-foreground">
          Ao alterar a senha, você continua conectado aqui e as sessões em outros aparelhos são encerradas.
        </p>
      )}
    </form>
  );
}
