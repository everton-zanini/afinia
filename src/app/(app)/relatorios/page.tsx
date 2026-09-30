import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/server/session";

export default async function Page() {
  await requireUser();
  return (
    <>
      <PageHeader title="Relatórios" />
      <EmptyState icon={BarChart3} title="Nada por aqui ainda" description="Relatórios aparecerão aqui." />
    </>
  );
}