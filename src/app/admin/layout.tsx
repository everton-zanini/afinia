import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/server/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card pt-safe">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden className="size-5 text-primary" />
            Administração
          </p>
          <Link
            href="/mais"
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-secondary"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Voltar ao app
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
        {children}
      </main>
    </div>
  );
}
