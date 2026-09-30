import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireHousehold } from "@/server/session";

export default async function Page() {
  await requireHousehold();
  return (
    <>
      <PageHeader title="Lançamentos" />
      <EmptyState icon={ListOrdered} title="Nada por aqui ainda" description="Seus lançamentos aparecerão aqui." />
    </>
  );
}