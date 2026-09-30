"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown } from "lucide-react";
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
export type FormAccount = { id: string; name: string };
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
}) {
  const [state, action] = useActionState(saveTransactionAction.bind(null, transactionId), { ok: false });
  const e = state.fieldErrors ?? {};

  const [kind, setKind] = useState<Kind>(initial.kind);
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
    return [...accounts].sort((a, b) => rank(a.id) - rank(b.id));
  }, [accounts, suggestedAccountIds]);

  const parsedAmount = parseBRL(amount);
  const effectiveDate = paid ? date : "";
  const dueDate = paid ? dueOverride || date : date;
  const paidLabel = kind === "INCOME" ? "Já foi recebido" : kind === "TRANSFER" ? "Já foi feita" : "Já foi pago";
  const dateLabel = paid
    ? kind === "INCOME" ? "Data do recebimento" : kind === "TRANSFER" ? "Data da transferência" : "Data do pagamento"
    : kind === "INCOME" ? "Data prevista" : "Vencimento";

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

      <Segmented
        name="kind"
        legend="Tipo de lançamento"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId("");
        }}
        options={KIND_OPTIONS}
      />

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
            {accounts.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Cadastre outra conta para transferir.{" "}
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
          {(e.dueDate || e.effectiveDate) && <FieldError>{e.effectiveDate ?? e.dueDate}</FieldError>}
          {!paid && <p className="text-sm text-muted-foreground">Fica como pendente: aparece nas previsões, não no saldo.</p>}
        </div>
      </section>

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
          {paid && (
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
          {transactionId ? "Salvar alterações" : "Salvar lançamento"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
