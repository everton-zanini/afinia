import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { requireAdmin } from "@/server/session";
import { listHouseholds } from "@/server/services/admin";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  await requireAdmin();
  const households = await listHouseholds();
  return (
    <>
      <PageHeader
        title="Casais"
        description="Cadastre e gerencie o acesso dos casais. Dados financeiros não aparecem aqui."
        actions={
          <Button asChild>
            <Link href="/admin/casais/novo">
              <Plus aria-hidden />
              Novo casal
            </Link>
          </Button>
        }
      />
      {households.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum casal cadastrado" description="Cadastre o primeiro casal para começar." />
      ) : (
        <ul className="grid gap-3">
          {households.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/casais/${h.id}`}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{h.name}</p>
                    <StatusBadge active={h.active} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {h.members.filter((m) => m.active).map((m) => m.user.name).join(" e ") || "Sem participantes"}
                  </p>
                </div>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
