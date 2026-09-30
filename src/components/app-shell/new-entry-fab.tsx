import Link from "next/link";
import { Plus } from "lucide-react";

export function NewEntryFab() {
  return (
    <Link
      href="/lancamentos/novo"
      className="fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-95 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:right-[max(1rem,calc((100vw-42rem)/2+1rem))]"
    >
      <Plus aria-hidden className="size-5" strokeWidth={2.6} />
      <span>Novo lançamento</span>
    </Link>
  );
}
