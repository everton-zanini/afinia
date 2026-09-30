import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Definir nova senha" };

export default async function SetPasswordPage() {
  const { user } = await requireUser({ allowTemporaryPassword: true });
  if (!user.mustChangePassword) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10 pt-safe">
      <Brand />
      <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
        <h1 className="text-lg font-semibold">Definir nova senha</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Olá, {user.name.split(" ")[0]}! Por segurança, troque a senha temporária antes de continuar.
        </p>
        <PasswordForm temporary />
      </section>
    </main>
  );
}
