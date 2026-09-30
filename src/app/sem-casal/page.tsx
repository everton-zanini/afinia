import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import { getCurrentHousehold, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Sem casal" };

export default async function NoHouseholdPage() {
  const { user } = await requireUser();
  if (await getCurrentHousehold(user.id)) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10 pt-safe">
      <Brand />
      <section className="grid gap-4 rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-border">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <HeartHandshake aria-hidden className="size-6" />
        </span>
        <h1 className="text-lg font-semibold">Você ainda não participa de um casal</h1>
        <p className="text-sm text-muted-foreground">
          {user.isPlatformAdmin
            ? "Como administrador, você pode cadastrar o seu casal e incluir-se como participante."
            : "Peça ao administrador para vincular você a um casal."}
        </p>
        {user.isPlatformAdmin && (
          <Button asChild size="lg">
            <Link href="/admin">Ir para a administração</Link>
          </Button>
        )}
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Sair
          </Button>
        </form>
      </section>
    </main>
  );
}
