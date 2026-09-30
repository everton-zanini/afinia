import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSession } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSession()) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10 pt-safe">
      <Brand />
      <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
        <h1 className="text-lg font-semibold">Entrar</h1>
        <p className="mb-5 text-sm text-muted-foreground">Use o email e a senha que você recebeu.</p>
        <LoginForm />
      </section>
      <p className="text-center text-sm text-muted-foreground">
        Esqueceu a senha? Peça ao administrador para definir uma senha temporária.
      </p>
    </main>
  );
}
