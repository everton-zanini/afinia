import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
