import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { FormMessage } from "@/components/form";
import { requireAdmin } from "@/server/session";
import { getHouseholdForAdmin } from "@/server/services/admin";
import { MAX_ACTIVE_MEMBERS } from "@/server/households/members";
import { StatusBadge } from "../../status-badge";
import { AddParticipantForm, ResetPasswordForm, ToggleActiveButton } from "./household-actions";

export const metadata: Metadata = { title: "Casal" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });

export default async function HouseholdAdminPage({ params, searchParams }: PageProps<"/admin/casais/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { criado } = await searchParams;
  const household = await getHouseholdForAdmin(id);
  if (!household) notFound();
  const activeMembers = household.members.filter((m) => m.active);

  return (
    <>
      <PageHeader
        title={household.name}
        backHref="/admin"
        description={<>Cadastrado em {dateFmt.format(household.createdAt)}</>}
      />
      <div className="grid gap-4">
        {criado && <FormMessage ok message="Casal cadastrado. Repasse as senhas temporárias aos participantes." />}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="grid gap-1">
            <p className="text-sm text-muted-foreground">Situação do acesso</p>
            <StatusBadge active={household.active} />
          </div>
          <ToggleActiveButton householdId={household.id} active={household.active} name={household.name} />
        </section>

        <section aria-labelledby="participantes" className="grid gap-3">
          <h2 id="participantes" className="px-1 font-semibold">
            Participantes ({activeMembers.length}/{MAX_ACTIVE_MEMBERS})
          </h2>
          {household.members.map((m) => (
            <article key={m.id} className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="min-w-0">
                <p className="font-medium">
                  {m.user.name}
                  {m.user.isPlatformAdmin && <span className="ml-2 text-xs text-muted-foreground">(administrador)</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{m.user.email}</p>
                <p className="mt-1 flex items-center gap-1 text-sm">
                  <KeyRound aria-hidden className="size-4 text-muted-foreground" />
                  {m.user.mustChangePassword ? "Aguardando troca da senha temporária" : "Senha definida pela pessoa"}
                </p>
              </div>
              <details className="group rounded-lg bg-muted/50 open:pb-3">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium text-primary">
                  Definir senha temporária
                </summary>
                <div className="px-3">
                  <ResetPasswordForm householdId={household.id} userId={m.user.id} />
                </div>
              </details>
            </article>
          ))}
        </section>

        {activeMembers.length < MAX_ACTIVE_MEMBERS && (
          <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-semibold">Adicionar participante</h2>
            <AddParticipantForm householdId={household.id} />
          </section>
        )}
      </div>
    </>
  );
}
