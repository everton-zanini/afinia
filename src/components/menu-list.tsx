import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export type MenuItem = { href: string; label: string; description: string; icon: LucideIcon };

export function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      {items.map(({ href, label, description, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/60">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{label}</span>
              <span className="block truncate text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
