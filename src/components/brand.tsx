import { cn } from "@/lib/utils";

/** Marca: dois círculos entrelaçados (duas pessoas, planos em comum). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-10", className)}>
      <rect width="48" height="48" rx="14" fill="var(--primary)" />
      <circle cx="19" cy="24" r="9" fill="none" stroke="#fff" strokeWidth="3.5" />
      <circle cx="29" cy="24" r="9" fill="none" stroke="#9fe0d6" strokeWidth="3.5" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className="text-xl font-semibold tracking-tight text-foreground">Afinia</p>
        <p className="text-sm text-muted-foreground">Duas pessoas. Planos em comum.</p>
      </div>
    </div>
  );
}
