import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Senha" };

export default async function PasswordPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Alterar senha" backHref="/mais" />
      <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <PasswordForm />
      </section>
    </>
  );
}
