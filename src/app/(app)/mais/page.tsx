import type { Metadata } from "next";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { MenuList } from "@/components/menu-list";
import { logoutAction } from "@/server/actions/auth";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Mais" };

export default async function MorePage() {
  const { user } = await requireUser();
  return (
    <>
      <PageHeader title="Mais" description={`${user.name} · ${user.email}`} />
      <div className="grid gap-6">
        <section aria-labelledby="conta" className="grid gap-2">
          <h2 id="conta" className="px-1 text-sm font-semibold text-muted-foreground">
            Sua conta
          </h2>
          <MenuList
            items={[
              { href: "/mais/perfil", label: "Perfil", description: "Nome e email", icon: UserRound },
              { href: "/mais/senha", label: "Senha", description: "Alterar sua senha", icon: KeyRound },
            ]}
          />
        </section>
        {user.isPlatformAdmin && (
          <section aria-labelledby="plataforma" className="grid gap-2">
            <h2 id="plataforma" className="px-1 text-sm font-semibold text-muted-foreground">
              Plataforma
            </h2>
            <MenuList
              items={[
                {
                  href: "/admin",
                  label: "Administração",
                  description: "Casais de teste e acessos",
                  icon: ShieldCheck,
                },
              ]}
            />
          </section>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-card font-medium text-destructive ring-1 ring-border hover:bg-expense-soft"
          >
            <LogOut aria-hidden className="size-5" />
            Sair
          </button>
        </form>
      </div>
    </>
  );
}
