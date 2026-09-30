import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireUser } from "@/server/session";
import { EmailForm, NameForm } from "./profile-forms";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { user } = await requireUser();
  return (
    <>
      <PageHeader title="Perfil" backHref="/mais" />
      <div className="grid gap-4">
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="mb-3 font-semibold">Nome</h2>
          <NameForm name={user.name} />
        </section>
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-semibold">Email de acesso</h2>
          <p className="mb-3 text-sm text-muted-foreground">Para trocar o email, confirme sua senha atual.</p>
          <EmailForm email={user.email} />
        </section>
      </div>
    </>
  );
}
