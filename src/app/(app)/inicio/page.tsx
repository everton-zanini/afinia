import { Home } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/server/session";

export default async function Page() {
  await requireUser();
  return (
    <>
      <PageHeader title="Início" />
      <EmptyState icon={Home} title="Nada por aqui ainda" description="Seu resumo financeiro aparecerá aqui." />
    </>
  );
}