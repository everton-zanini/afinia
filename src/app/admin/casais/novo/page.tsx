import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireAdmin } from "@/server/session";
import { adminHasHousehold } from "@/server/services/admin";
import { NewHouseholdForm } from "./new-household-form";

export const metadata: Metadata = { title: "Novo casal" };

export default async function NewHouseholdPage() {
  const { user } = await requireAdmin();
  const canJoin = !(await adminHasHousehold(user.id));
  return (
    <>
      <PageHeader title="Novo casal" backHref="/admin" />
      <NewHouseholdForm canJoin={canJoin} adminName={user.name} />
    </>
  );
}
