import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  backHref,
  actions,
}: {
  title: string;
  description?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pb-4 pt-2">
      <div className="flex min-w-0 items-start gap-1">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Voltar"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </Link>
        )}
        <div className="min-w-0 pt-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
