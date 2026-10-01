"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Repeat } from "lucide-react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { CategoryBadge } from "@/components/category-icon";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveTransactionAction } from "@/server/actions/finance";

type Kind = "EXPENSE" | "INCOME" | "TRANSFER";

export type FormCategory = { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null; color: string; icon: string };
export type FormAccount = { id: string; name: string; benefit?: boolean };
export type FormMember = { memberId: string; name: string };

export type TransactionInitial = {
  kind: Kind;
  description: string;
  amountCents: number | null;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  status: "PENDING" | "EFFECTIVE";
  dueDate: string;
  effectiveDate: string | null;
  responsibleMemberId: string | null;
  notes: string | null;
};

const KIND_OPTIONS = [
  { value: "EXPENSE" as const, label: <><ArrowUpRight aria-hidden className="size-4" />Despesa</>, activeClass: "bg-expense text-white shadow-sm" },
  { value: "INCOME" as const, label: <><ArrowDownLeft aria-hidden className="size-4" />Receita</>, activeClass: "bg-income text-white shadow-sm" },
  { value: "TRANSFER" as const, label: <><ArrowLeftRight aria-hidden className="size-4" />Transferir</>, activeClass: "bg-transfer text-white shadow-sm" },
];

export function TransactionForm({
  transactionId,
  idempotencyKey,
  initial,
  categories,
  accounts,
  members,
  suggestedCategoryIds,
  suggestedAccountIds,
  today,
  series,
}: {
  transactionId: string | null;
  idempotencyKey: string;
  initial: TransactionInitial;
  categories: FormCategory[];
  accounts: FormAccount[];
  members: FormMember[];
  suggestedCategoryIds: string[];
  suggestedAccountIds: string[];
  today: string;
  /** Edição de uma ocorrência de recorrência: posição e frequência (somente leitura). */
  series?: { label: string; frequencyLabel: string } | null;
}) {
  const [state, action] = useActionState(saveTransactionAction.bind(null, transactionId), { ok: false });
  const e = state.fieldErrors ?? {};
  const canRepeat = !transactionId;
  const isOccurrence = !!series;

  const [kind, setKind] = useState<Kind>(initial.kind);
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [endMode, setEndMode] = useState<"COUNT" | "UNTIL" | "NONE">("NONE");
  const [paidOn, setPaidOn] = useState(today);
  const [scope, setScope] = useState<"only" | "following">("only");
  const [amount, setAmount] = useState(initial.amountCents ? centsToInput(initial.amountCents) : "");
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [accountId, setAccountId] = useState(initial.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(initial.toAccountId ?? "");
  const [paid, setPaid] = useState(initial.status === "EFFECTIVE");
  const [date, setDate] = useState(initial.status === "EFFECTIVE" ? initial.effectiveDate! : initial.dueDate);
  const separateDue = initial.status === "EFFECTIVE" && initial.dueDate !== initial.effectiveDate;
  const [dueOverride, setDueOverride] = useState(separateDue ? initial.dueDate : "");
  const [advancedOpen, setAdvancedOpen] = useState(separateDue || !!initial.notes || !!initial.responsibleMemberId);

  const kindCategories = useMemo(
    () => categories.filter((c) => kind !== "TRANSFER" && c.kind === kind),
    [categories, kind],
  );
  const chips = useMemo(() => {
    const suggested = suggestedCategoryIds
      .map((id) => kindCategories.find((c) => c.id === id))
      .filter((c): c is FormCategory => !!c);
    // Mais usadas primeiro; completa com as categorias principais até 6 sugestões.
    const fill = kindCategories.filter((c) => !c.parentId && !suggested.some((s) => s.id === c.id));
    const list = [...suggested, ...fill].slice(0, 6);
    const selected = kindCategories.find((c) => c.id === categoryId);
    if (selected && !list.some((c) => c.id === selected.id)) list.unshift(selected);
    return list;
  }, [kindCategories, suggestedCategoryIds, categoryId]);

  const orderedAccounts = useMemo(() => {
    const rank = (id: string) => {
      const i = suggestedAccountIds.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    // Benefícios não participam de transferências (nem como origem nem como destino).
    const eligible = kind === "TRANSFER" ? accounts.filter((a) => !a.benefit) : accounts;
    return [...eligible].sort((a, b) => rank(a.id) - rank(b.id));
  }, [accounts, suggestedAccountIds, kind]);

  const parsedAmount = parseBRL(amount);
  // Recorrência: a data principal é a primeira ocorrência (prevista); a efetivação, se houver,
  // é informada à parte e não pode ser futura.
  const repeating = canRepeat && repeat;
  const effectiveDate = paid ? (repeating ? paidOn : date) : "";
  const dueDate = repeating ? date : paid ? dueOverride || date : date;
  const paidLabel = kind === "INCOME" ? "Já foi recebido" : kind === "TRANSFER" ? "Já foi realizada" : "Já foi pago";
  const paidDateLabel = kind === "INCOME" ? "Data do recebimento" : kind === "TRANSFER" ? "Data da transferência" : "Data do pagamento";
  const dateLabel = repeating
    ? "Primeira ocorrência"
    : paid
      ? paidDateLabel
      : kind === "INCOME" ? "Data prevista" : "Vencimento";
  const followingAllowed = isOccurrence && initial.status === "PENDING";

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-5 text-center ring-1 ring-border">
        <p className="font-semibold">Cadastre uma conta primeiro</p>
        <p className="mt-1 text-sm text-muted-foreground">Todo lançamento sai de (ou entra em) uma conta: banco, dinheiro ou reserva.</p>
        <Link href="/mais/contas/nova" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground">
          Cadastrar conta
        </Link>
      </div>
    );
  }

  const categoryOptions = (list: FormCategory[]) =>
    list
      .filter((c) => !c.parentId)
      .flatMap((p) => [
        <option key={p.id} value={p.id}>{p.name}</option>,
        ...list
          .filter((c) => c.parentId === p.id)
          .map((c) => <option key={c.id} value={c.id}>{`   ${p.name} › ${c.name}`}</option>),
      ]);

  return (
    <ActionForm action={action} className="grid gap-4" offlineMessage="Sem conexão. O lançamento não foi salvo.">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="status" value={paid ? "EFFECTIVE" : "PENDING"} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="effectiveDate" value={effectiveDate} />
      {repeating && <input type="hidden" name="repeat" value="on" />}

      {isOccurrence ? (
        <section className="grid gap-3 rounded-2xl bg-secondary/60 p-4">
          <input type="hidden" name="kind" value={kind} />
          <p className="flex items-center gap-2 font-medium text-secondary-foreground">
            <Repeat aria-hidden className="size-4" />
            {series!.label} · {series!.frequencyLabel}
          </p>
          <p className="text-sm text-muted-foreground">
            Tipo e frequência não mudam. Para mudá-los, encerre esta recorrência e crie outra.
          </p>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Aplicar alterações a</legend>
            {(
              [
                { value: "only", label: "Só este lançamento", hint: "Pode mudar inclusive a data. Ele deixa de seguir as próximas alterações da série." },
                ...(followingAllowed
                  ? [{ value: "following", label: "Este e os próximos", hint: "Muda a regra a partir daqui. Não altera datas, efetivados nem lançamentos ajustados individualmente." }]
                  : []),
              ] as { value: "only" | "following"; label: string; hint: string }[]
            ).map((o) => (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-card p-3 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
                <input type="radio" name="scope" value={o.value} checked={scope === o.value} onChange={() => setScope(o.value)} className="mt-1 size-4 accent-[var(--primary)]" />
                <span>
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-sm text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      ) : (
        <Segmented
          name="kind"
          legend="Tipo de lançamento"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId("");
            if (k === "TRANSFER" && accounts.find((a) => a.id === accountId)?.benefit) {
              setAccountId(accounts.find((a) => !a.benefit)?.id ?? "");
            }
          }}
          options={KIND_OPTIONS}
        />
      )}

      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="grid gap-1">
          <Label htmlFor="amount">Valor</Label>
          <div
            className={cn(
              "flex items-baseline gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
              e.amount && "border-destructive",
            )}
          >
            <span aria-hidden className="text-xl font-medium text-muted-foreground">R$</span>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value.replace(/[^\d.,-]/g, ""))}
              onBlur={() => parsedAmount !== null && parsedAmount > 0 && setAmount(formatBRL(parsedAmount).replace(/^R\$\s/, ""))}
              aria-invalid={e.amount ? true : undefined}
              aria-describedby={e.amount ? "amount-error" : undefined}
              className="tabular w-full min-w-0 bg-transparent text-3xl font-semibold outline-none placeholder:text-muted-foreground/60"
              autoFocus={!transactionId}
            />
          </div>
          {e.amount && <FieldError id="amount-error">{e.amount}</FieldError>}
        </div>

        <Field
          label="Descrição"
          name="description"
          defaultValue={initial.description}
          placeholder={kind === "INCOME" ? "Ex.: Salário" : kind === "TRANSFER" ? "Ex.: Guardar na reserva" : "Ex.: Mercado"}
          autoComplete="off"
          maxLength={120}
          error={e.description}
        />
      </section>

      {kind !== "TRANSFER" ? (
        <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Categoria</legend>
            {kindCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria de {kind === "INCOME" ? "receita" : "despesa"}.{" "}
                <Link href="/mais/categorias/nova" className="font-medium text-primary underline">Criar categoria</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ring-1 ring-border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                      categoryId === c.id ? "bg-secondary font-semibold text-secondary-foreground ring-2 ring-primary" : "bg-card",
                    )}
                  >
                    <input type="radio" name="categoryChip" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} className="sr-only" />
                    <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {kindCategories.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="categoryId" className="text-sm text-muted-foreground">Todas as categorias</Label>
              <NativeSelect id="categoryId" name="categoryId" value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)} aria-invalid={e.categoryId ? true : undefined}>
                <option value="">Escolha…</option>
                {categoryOptions(kindCategories)}
              </NativeSelect>
            </div>
          )}
          {e.categoryId && <FieldError>{e.categoryId}</FieldError>}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{kind === "TRANSFER" ? "De qual conta" : kind === "INCOME" ? "Em qual conta" : "De qual conta"}</legend>
          <div className="flex flex-wrap gap-2">
            {orderedAccounts.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm ring-1 ring-border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                  accountId === a.id ? "bg-secondary font-semibold text-secondary-foreground ring-2 ring-primary" : "bg-card",
                )}
              >
                <input type="radio" name="accountId" value={a.id} checked={accountId === a.id} onChange={() => setAccountId(a.id)} className="sr-only" />
                {a.name}
              </label>
            ))}
          </div>
          {e.accountId && <FieldError>{e.accountId}</FieldError>}
        </fieldset>
        {kind === "TRANSFER" && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Para qual conta</legend>
            {orderedAccounts.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Transferências usam contas bancárias, dinheiro ou reservas; benefícios não permitem transferência ou saque. Cadastre outra conta para transferir.{" "}
                <Link href="/mais/contas/nova" className="font-medium text-primary underline">Nova conta</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {orderedAccounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm ring-1 ring-border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                        toAccountId === a.id ? "bg-secondary font-semibold text-secondary-foreground ring-2 ring-primary" : "bg-card",
                      )}
                    >
                      <input type="radio" name="toAccountId" value={a.id} checked={toAccountId === a.id} onChange={() => setToAccountId(a.id)} className="sr-only" />
                      {a.name}
                    </label>
                  ))}
              </div>
            )}
            {e.toAccountId && <FieldError>{e.toAccountId}</FieldError>}
          </fieldset>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="paid" className="text-base">{paidLabel}</Label>
          <Switch id="paid" checked={paid} onCheckedChange={setPaid} className="scale-125" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="date">{dateLabel}</Label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            required
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2">
            {[
              { label: "Hoje", value: today },
            ].map((q) => (
              <button key={q.label} type="button" onClick={() => setDate(q.value)} className="min-h-9 rounded-full bg-muted px-3 text-sm font-medium">
                {q.label}
              </button>
            ))}
          </div>
          {!repeating && (e.dueDate || e.effectiveDate) && <FieldError>{e.effectiveDate ?? e.dueDate}</FieldError>}
          {repeating && e.dueDate && <FieldError>{e.dueDate}</FieldError>}
          {!paid && <p className="text-sm text-muted-foreground">Fica como pendente: aparece nas previsões, não no saldo.</p>}
        </div>
        {repeating && paid && (
          <div className="grid gap-1.5">
            <Label htmlFor="paidOn">{paidDateLabel}</Label>
            <input
              id="paidOn"
              type="date"
              value={paidOn}
              max={today}
              onChange={(ev) => setPaidOn(ev.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
            />
            <p className="text-sm text-muted-foreground">Vale só para a primeira ocorrência; as próximas ficam pendentes.</p>
            {e.effectiveDate && <FieldError>{e.effectiveDate}</FieldError>}
          </div>
        )}
      </section>

      {canRepeat && (
        <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="repeat" className="flex items-center gap-2 text-base">
              <Repeat aria-hidden className="size-4 text-primary" /> Repetir
            </Label>
            <Switch id="repeat" checked={repeat} onCheckedChange={setRepeat} className="scale-125" />
          </div>
          {repeat && (
            <>
              <Segmented
                name="frequency"
                legend="Frequência"
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: "WEEKLY", label: "Semanal" },
                  { value: "MONTHLY", label: "Mensal" },
                  { value: "YEARLY", label: "Anual" },
                ]}
              />
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Termina</legend>
                <label className="flex min-h-11 items-center gap-3">
                  <input type="radio" name="endMode" value="NONE" checked={endMode === "NONE"} onChange={() => setEndMode("NONE")} className="size-4 accent-[var(--primary)]" />
                  Sem término
                </label>
                <label className="flex min-h-11 flex-wrap items-center gap-3">
                  <input type="radio" name="endMode" value="COUNT" checked={endMode === "COUNT"} onChange={() => setEndMode("COUNT")} className="size-4 accent-[var(--primary)]" />
                  Após
                  <input
                    name="occurrenceCount"
                    aria-label="Número de ocorrências"
                    inputMode="numeric"
                    type="number"
                    min={2}
                    max={600}
                    disabled={endMode !== "COUNT"}
                    defaultValue={12}
                    className="h-11 w-20 rounded-lg border border-input bg-card px-2 text-base disabled:opacity-50"
                  />
                  ocorrências
                </label>
                <label className="flex min-h-11 flex-wrap items-center gap-3">
                  <input type="radio" name="endMode" value="UNTIL" checked={endMode === "UNTIL"} onChange={() => setEndMode("UNTIL")} className="size-4 accent-[var(--primary)]" />
                  Até
                  <input
                    name="untilDate"
                    aria-label="Data final (inclusive)"
                    type="date"
                    disabled={endMode !== "UNTIL"}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-base disabled:opacity-50"
                  />
                </label>
                {(e.occurrenceCount || e.untilDate || e.endMode) && <FieldError>{e.occurrenceCount ?? e.untilDate ?? e.endMode}</FieldError>}
              </fieldset>
              <p className="text-sm text-muted-foreground">
                As ocorrências dos próximos 12 meses aparecem como pendentes; as seguintes são criadas automaticamente.
              </p>
            </>
          )}
        </section>
      )}

      <section className="rounded-2xl bg-card ring-1 ring-border">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          aria-controls="mais-detalhes"
          className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-medium"
        >
          Mais detalhes
          <ChevronDown aria-hidden className={cn("size-5 transition-transform", advancedOpen && "rotate-180")} />
        </button>
        <div id="mais-detalhes" hidden={!advancedOpen} className="grid gap-4 px-4 pb-4">
          {paid && !repeating && (
            <div className="grid gap-1.5">
              <Label htmlFor="dueOverride">Vencimento (se diferente)</Label>
              <input
                id="dueOverride"
                type="date"
                value={dueOverride}
                onChange={(ev) => setDueOverride(ev.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
              />
            </div>
          )}
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
            <Textarea id="notes" name="notes" defaultValue={initial.notes ?? ""} maxLength={500} rows={3} className="text-base" />
            {e.notes && <FieldError>{e.notes}</FieldError>}
          </div>
        </div>
      </section>

      <FormMessage ok={state.ok} message={state.message} />
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-2 pt-4">
        <SubmitButton size="lg" pendingLabel="Salvando…">
          {transactionId ? "Salvar alterações" : repeating ? "Salvar recorrência" : "Salvar lançamento"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
