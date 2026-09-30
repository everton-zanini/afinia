"use client";

import { useActionState } from "react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { centsToInput } from "@/lib/money";
import { saveAccountAction } from "@/server/actions/finance";
import type { AccountDTO } from "@/server/finance/accounts";

export function AccountForm({ account, today }: { account?: AccountDTO; today: string }) {
  const [state, action] = useActionState(saveAccountAction.bind(null, account?.id ?? null), { ok: false });
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-4">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field label="Nome" name="name" placeholder="Ex.: Conta corrente" defaultValue={account?.name} error={e.name} />
        <div className="grid gap-1.5">
          <Label htmlFor="kind">Tipo</Label>
          <NativeSelect id="kind" name="kind" defaultValue={account?.kind ?? "CHECKING"}>
            <option value="CHECKING">Conta bancária</option>
            <option value="CASH">Dinheiro</option>
            <option value="RESERVE">Reserva</option>
          </NativeSelect>
          {e.kind && <FieldError>{e.kind}</FieldError>}
        </div>
        <Field
          label="Saldo na data de abertura (R$)"
          name="openingBalance"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={account ? centsToInput(account.openingBalanceCents) : ""}
          hint="Quanto havia na conta nessa data. Não conta como receita. Use sinal de menos se estava negativa."
          error={e.openingBalance}
        />
        <Field
          label="Data de abertura"
          name="openingDate"
          type="date"
          defaultValue={account?.openingDate ?? today}
          hint="Pagamentos e recebimentos nesta conta precisam ser nesta data ou depois."
          error={e.openingDate}
        />
      </section>
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">{account ? "Salvar alterações" : "Cadastrar conta"}</SubmitButton>
    </ActionForm>
  );
}
