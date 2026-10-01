"use client";

import { useActionState, useState } from "react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { centsToInput } from "@/lib/money";
import { saveAccountAction } from "@/server/actions/finance";
import type { AccountDTO, AccountKind } from "@/server/finance/accounts";

const NAME_PLACEHOLDER: Record<AccountKind, string> = {
  CHECKING: "Ex.: Conta corrente",
  CASH: "Ex.: Carteira",
  RESERVE: "Ex.: Reserva de emergência",
  BENEFIT: "Ex.: Meu vale-alimentação",
};

export function AccountForm({ account, today }: { account?: AccountDTO; today: string }) {
  const [state, action] = useActionState(saveAccountAction.bind(null, account?.id ?? null), { ok: false });
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "CHECKING");
  const e = state.fieldErrors ?? {};
  const benefit = kind === "BENEFIT";
  return (
    <ActionForm action={action} className="grid gap-4">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="grid gap-1.5">
          <Label htmlFor="kind">Tipo</Label>
          <NativeSelect id="kind" name="kind" value={kind} onChange={(ev) => setKind(ev.target.value as AccountKind)}>
            <option value="CHECKING">Conta bancária</option>
            <option value="CASH">Dinheiro</option>
            <option value="RESERVE">Reserva</option>
            <option value="BENEFIT">Benefício (vale pré-pago)</option>
          </NativeSelect>
          {benefit && (
            <p className="text-sm text-muted-foreground">
              Cartão com saldo pré-pago, como vale-alimentação, vale-refeição ou combustível. Não tem fatura e não permite transferências.
            </p>
          )}
          {e.kind && <FieldError>{e.kind}</FieldError>}
        </div>
        <Field
          label="Nome"
          name="name"
          placeholder={NAME_PLACEHOLDER[kind]}
          defaultValue={account?.name}
          hint="Escolha um nome que vocês reconheçam."
          error={e.name}
        />
        {benefit && (
          <div className="grid gap-1.5">
            <Label htmlFor="benefitPurpose">Finalidade</Label>
            <NativeSelect id="benefitPurpose" name="benefitPurpose" defaultValue={account?.benefitPurpose ?? ""}>
              <option value="">Escolha…</option>
              <option value="FOOD">Alimentação</option>
              <option value="MEAL">Refeição</option>
              <option value="MOBILITY">Mobilidade/combustível</option>
              <option value="FLEXIBLE">Flexível</option>
              <option value="OTHER">Outros</option>
            </NativeSelect>
            <p className="text-sm text-muted-foreground">Só para identificação: o app não bloqueia compras por finalidade.</p>
            {e.benefitPurpose && <FieldError>{e.benefitPurpose}</FieldError>}
          </div>
        )}
        <Field
          label="Saldo na data de abertura (R$)"
          name="openingBalance"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={account ? centsToInput(account.openingBalanceCents) : ""}
          hint={
            benefit
              ? "Saldo disponível no cartão nessa data. Não conta como receita."
              : "Quanto havia na conta nessa data. Não conta como receita. Use sinal de menos se estava negativa."
          }
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
