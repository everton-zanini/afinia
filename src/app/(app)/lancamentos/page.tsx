import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/server/session";

export default async function Page() {
  await requireUser();
  return (
    <>
      <PageHeader title="Lançamentos" />
      <EmptyState icon={ListOrdered} title="Nada por aqui ainda" description="Seus lançamentos aparecerão aqui." />
    </>
  );
}