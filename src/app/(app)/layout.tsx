import { BottomNav } from "@/components/app-shell/bottom-nav";
import { NewEntryFab } from "@/components/app-shell/new-entry-fab";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-2xl px-4 pt-safe pb-[calc(9rem+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
      <NewEntryFab />
      <BottomNav />
    </div>
  );
}
