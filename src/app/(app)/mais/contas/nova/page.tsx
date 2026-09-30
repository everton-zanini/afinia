import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { todayISO } from "@/lib/dates";
import { requireHousehold } from "@/server/session";
import { AccountForm } from "../account-form";

export const metadata: Metadata = { title: "Nova conta" };

export default async function NewAccountPage() {
  await requireHousehold();
  return (
    <>
      <PageHeader title="Nova conta" backHref="/mais/contas" />
      <AccountForm today={todayISO()} />
    </>
  );
}
