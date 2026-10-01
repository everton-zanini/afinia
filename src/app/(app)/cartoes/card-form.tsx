"use client";

import { useActionState } from "react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS } from "@/lib/category-style";
import { centsToInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveCardAction } from "@/server/actions/cards";

export type CardFormInitial = {
  id: string;
  name: string;
  issuer: string | null;
  lastFour: string | null;
  color: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  holderMemberId: string | null;
  paymentAccountId: string | null;
};

export function CardForm({
  card,
  members,
  accounts,
}: {
  card?: CardFormInitial;
  members: { memberId: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveCardAction.bind(null, card?.id ?? null), { ok: false });
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-4" offlineMessage="Sem conexão. O cartão não foi salvo.">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field label="Nome do cartão" name="name" defaultValue={card?.name} placeholder="Ex.: Cartão roxo" maxLength={40} autoComplete="off" error={e.name} />
        <Field label="Emissor (opcional)" name="issuer" defaultValue={card?.issuer ?? ""} placeholder="Ex.: Banco X" maxLength={40} autoComplete="off" error={e.issuer} />
        <Field
          label="Últimos 4 dígitos (opcional)"
          name="lastFour"
          defaultValue={card?.lastFour ?? ""}
          inputMode="numeric"
          autoComplete="off"
          hint="Informe somente os 4 últimos dígitos. O Afinia nunca guarda número completo, CVV ou senha."
          error={e.lastFour}
        />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c, i) => (
              <label
                key={c}
                className="relative flex size-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <input type="radio" name="color" value={c} defaultChecked={card ? card.color === c : i === 4} className="peer sr-only" aria-label={`Cor ${i + 1}`} />
                <span aria-hidden className={cn("size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-foreground")} style={{ backgroundColor: c }} />
              </label>
            ))}
          </div>
          {e.color && <FieldError>{e.color}</FieldError>}
        </fieldset>
      </section>

      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field
          label="Limite informado (R$)"
          name="limit"
          inputMode="decimal"
          defaultValue={card ? centsToInput(card.limitCents) : ""}
          placeholder="5.000,00"
          hint="Estimativa manual: o app não consulta o banco."
          error={e.limit}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento" name="closingDay" inputMode="numeric" defaultValue={card?.closingDay ?? ""} placeholder="5" error={e.closingDay} />
          <Field label="Dia de vencimento" name="dueDay" inputMode="numeric" defaultValue={card?.dueDay ?? ""} placeholder="15" error={e.dueDay} />
        </div>
        <p className="text-sm text-muted-foreground">
          {card
            ? "Alterar fechamento ou vencimento vale só para faturas criadas depois. Faturas já existentes, inclusive futuras criadas por parcelas, mantêm suas datas e nenhuma compra é movida."
            : "Meses com menos dias usam o último dia do mês, sem perder o dia configurado nos meses seguintes."}
        </p>
      </section>

      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="grid gap-1.5">
          <Label htmlFor="holderMemberId">Titular</Label>
          <NativeSelect id="holderMemberId" name="holderMemberId" defaultValue={card?.holderMemberId ?? members[0]?.memberId ?? ""} aria-invalid={e.holderMemberId ? true : undefined}>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>{m.name}</option>
            ))}
          </NativeSelect>
          <p className="text-sm text-muted-foreground">Só informativo: os dois membros do casal veem e gerenciam o cartão.</p>
          {e.holderMemberId && <FieldError>{e.holderMemberId}</FieldError>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paymentAccountId">Conta sugerida para pagar a fatura (opcional)</Label>
          <NativeSelect id="paymentAccountId" name="paymentAccountId" defaultValue={card?.paymentAccountId ?? ""} aria-invalid={e.paymentAccountId ? true : undefined}>
            <option value="">Sem conta sugerida</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </NativeSelect>
          <p className="text-sm text-muted-foreground">Contas de benefício não podem pagar fatura.</p>
          {e.paymentAccountId && <FieldError>{e.paymentAccountId}</FieldError>}
        </div>
      </section>

      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">{card ? "Salvar alterações" : "Cadastrar cartão"}</SubmitButton>
    </ActionForm>
  );
}
