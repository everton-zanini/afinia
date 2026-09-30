import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/server/session";

export default async function Page() {
  await requireUser();
  return (
    <>
      <PageHeader title="Novo lançamento" />
      <EmptyState icon={Plus} title="Nada por aqui ainda" description="O formulário de lançamento será habilitado na etapa de gestão financeira." />
    </>
  );
}