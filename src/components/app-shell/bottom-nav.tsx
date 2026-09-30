"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, ListOrdered, Menu, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/lancamentos", label: "Lançamentos", icon: ListOrdered },
  { href: "/planejamento", label: "Planejamento", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/mais", label: "Mais", icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0 text-[0.66rem] font-medium tracking-tight transition-colors min-[380px]:text-[0.72rem]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-secondary",
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cn("max-w-full truncate", active && "font-semibold")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
