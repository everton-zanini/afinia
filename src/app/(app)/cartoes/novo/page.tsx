import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { listAccounts } from "@/server/finance/accounts";
import { requireHousehold } from "@/server/session";
import { CardForm } from "../card-form";

export const metadata: Metadata = { title: "Novo cartão" };

export default async function NewCardPage() {
  const { ctx } = await requireHousehold();
  const accounts = (await listAccounts(ctx)).filter((a) => a.kind !== "BENEFIT");
  return (
    <>
      <PageHeader title="Novo cartão" backHref="/cartoes" />
      <CardForm members={ctx.members.map((m) => ({ memberId: m.memberId, name: m.name }))} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </>
  );
}
