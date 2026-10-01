"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { splitInstallments, type CardDays } from "@/lib/finance/cards";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { confirmForecastAction, savePurchaseAction } from "@/server/actions/cards";
import { InstallmentPreview, InvoiceSelect, useInvoiceChoice, type KnownInvoice } from "./invoice-choice";

export type PurchaseCategory = { id: string; name: string; parentId: string | null };

export type PurchaseInitial = {
  description: string;
  totalCents: number | null;
  purchaseDate: string;
  categoryId: string;
  responsibleMemberId: string | null;
  notes: string | null;
  installmentCount: number;
  invoiceId: string;
};

type Common = {
  cardId: string;
  cardName: string;
  cardDays: CardDays;
  availableCents: number;
  known: KnownInvoice[];
  today: string;
};

function categoryOptions(list: PurchaseCategory[]) {
  return list
    .filter((c) => !c.parentId)
    .flatMap((p) => [
      <option key={p.id} value={p.id}>{p.name}</option>,
      ...list.filter((c) => c.parentId === p.id).map((c) => <option key={c.id} value={c.id}>{`   ${p.name} › ${c.name}`}</option>),
    ]);
}

/** Nova compra (ou edição). Com `locked`, valores, datas e fatura ficam fixos: só os textos mudam. */
export function PurchaseForm({
  purchaseId,
  idempotencyKey,
  initial,
  categories,
  members,
  locked = false,
  ...c
}: Common & {
  purchaseId: string | null;
  idempotencyKey: string;
  initial: PurchaseInitial;
  categories: PurchaseCategory[];
  members: { memberId: string; name: string }[];
  locked?: boolean;
}) {
  const [state, action] = useActionState(savePurchaseAction.bind(null, purchaseId), { ok: false });
  const e = state.fieldErrors ?? {};
  const [total, setTotal] = useState(initial.totalCents ? centsToInput(initial.totalCents) : "");
  const [date, setDate] = useState(initial.purchaseDate);
  const [count, setCount] = useState(String(initial.installmentCount));
  const [invoiceId, setInvoiceId] = useState(initial.invoiceId);

  const totalCents = parseBRL(total);
  const n = Number(count);
  const parts = useMemo(
    () => (totalCents && totalCents > 0 && Number.isInteger(n) ? splitInstallments(totalCents, n) : null),
    [totalCents, n],
  );
  const choice = useInvoiceChoice(c.known, c.cardDays, date, invoiceId, Number.isInteger(n) && n >= 1 ? n : 1);
  const over = parts !== null && !locked && totalCents !== null && totalCents > c.availableCents;
  const showPreview = !!choice && !locked && totalCents !== null && totalCents > 0 && n >= 1;

  return (
    <ActionForm action={action} className="grid gap-4" offlineMessage="Sem conexão. A compra não foi salva.">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="cardId" value={c.cardId} />
      {locked && (
        <>
          <input type="hidden" name="total" value={centsToInput(initial.totalCents ?? 0)} />
          <input type="hidden" name="purchaseDate" value={initial.purchaseDate} />
          <input type="hidden" name="installmentCount" value={initial.installmentCount} />
          <input type="hidden" name="invoiceId" value={initial.invoiceId} />
        </>
      )}
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field label="Descrição" name="description" defaultValue={initial.description} placeholder="Ex.: Mercado" autoComplete="off" maxLength={120} error={e.description} />
        {locked ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Há pagamento registrado em uma fatura desta compra: valor, parcelas, data e fatura não podem mudar. Se foi um erro de cadastro, desfaça o pagamento antes.
          </p>
        ) : (
          <>
            <Field
              label="Valor total (R$)"
              name="total"
              inputMode="decimal"
              value={total}
              onChange={(ev) => setTotal(ev.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0,00"
              autoComplete="off"
              error={e.total}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Data da compra"
                name="purchaseDate"
                type="date"
                value={date}
                max={c.today}
                onChange={(ev) => setDate(ev.target.value)}
                error={e.purchaseDate}
              />
              <Field
                label="Parcelas"
                name="installmentCount"
                inputMode="numeric"
                type="number"
                min={1}
                max={48}
                value={count}
                onChange={(ev) => setCount(ev.target.value)}
                error={e.installmentCount}
                hint="1 a 48"
              />
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="categoryId">Categoria</Label>
          <NativeSelect id="categoryId" name="categoryId" defaultValue={initial.categoryId} aria-invalid={e.categoryId ? true : undefined}>
            <option value="">Escolha…</option>
            {categoryOptions(categories)}
          </NativeSelect>
          {e.categoryId && <FieldError>{e.categoryId}</FieldError>}
        </div>
        {members.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="responsibleMemberId">Pessoa responsável</Label>
            <NativeSelect id="responsibleMemberId" name="responsibleMemberId" defaultValue={initial.responsibleMemberId ?? ""}>
              <option value="">Ninguém em especial</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>{m.name}</option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Observação</Label>
          <Textarea id="notes" name="notes" defaultValue={initial.notes ?? ""} maxLength={500} rows={2} className="text-base" />
          {e.notes && <FieldError>{e.notes}</FieldError>}
        </div>
      </section>

      {!locked && choice && (
        <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <InvoiceSelect options={choice.options} value={choice.options.some((o) => o.value === invoiceId) ? invoiceId : ""} onChange={setInvoiceId} error={e.invoiceId} />
          {showPreview && <InstallmentPreview parts={parts} cycles={choice.installments} />}
          {over && (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-destructive">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              Esta compra deixa o cartão acima do limite estimado ({formatBRL(c.availableCents)} disponíveis). Você ainda pode salvar.
            </p>
          )}
        </section>
      )}

      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">{purchaseId ? "Salvar alterações" : "Registrar compra"}</SubmitButton>
    </ActionForm>
  );
}

/** Confirmação de uma cobrança recorrente prevista: revisa valor, data (não futura) e fatura. */
export function ConfirmForecastForm({
  forecastId,
  description,
  initialCents,
  confirmDate,
  ...c
}: Common & { forecastId: string; description: string; initialCents: number; confirmDate: string }) {
  const [state, action] = useActionState(confirmForecastAction.bind(null, forecastId), { ok: false });
  const e = state.fieldErrors ?? {};
  const [amount, setAmount] = useState(centsToInput(initialCents));
  const [date, setDate] = useState(confirmDate);
  const [invoiceId, setInvoiceId] = useState("");
  const choice = useInvoiceChoice(c.known, c.cardDays, date, invoiceId, 1);
  return (
    <ActionForm action={action} className="grid gap-4" offlineMessage="Sem conexão. A cobrança não foi confirmada.">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">
          Confirmar vira uma compra à vista em <strong>{c.cardName}</strong>, uma única vez. Nenhuma despesa comum é criada.
        </p>
        <p className="font-medium">{description}</p>
        <Field label="Valor (R$)" name="amount" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value.replace(/[^\d.,]/g, ""))} error={e.amount} />
        <Field label="Data da compra" name="date" type="date" value={date} max={c.today} onChange={(ev) => setDate(ev.target.value)} error={e.date} />
        {choice && <InvoiceSelect options={choice.options} value={choice.options.some((o) => o.value === invoiceId) ? invoiceId : ""} onChange={setInvoiceId} error={e.invoiceId} />}
      </section>
      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">Confirmar cobrança</SubmitButton>
    </ActionForm>
  );
}
