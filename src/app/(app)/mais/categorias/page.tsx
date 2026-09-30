import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoryBadge } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { listCategories, type CategoryDTO } from "@/server/finance/categories";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Categorias" };

function Group({ title, items, all }: { title: string; items: CategoryDTO[]; all: CategoryDTO[] }) {
  const parents = items.filter((c) => !c.parentId);
  return (
    <section aria-labelledby={`g-${title}`} className="grid gap-2">
      <h2 id={`g-${title}`} className="px-1 text-sm font-semibold text-muted-foreground">
        {title}
      </h2>
      {parents.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">Nenhuma categoria.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {parents.map((p) => (
            <li key={p.id}>
              <CategoryRow c={p} />
              {all
                .filter((c) => c.parentId === p.id)
                .map((child) => (
                  <CategoryRow key={child.id} c={child} child />
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryRow({ c, child }: { c: CategoryDTO; child?: boolean }) {
  return (
    <Link
      href={`/mais/categorias/${c.id}`}
      className={`flex min-h-14 items-center gap-3 py-2.5 pr-4 hover:bg-muted/60 ${child ? "pl-12" : "pl-4"}`}
    >
      <CategoryBadge icon={c.icon} color={c.color} size={child ? "sm" : "md"} className={c.archived ? "opacity-50" : ""} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{c.name}</span>
        {c.archived && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Archive aria-hidden className="size-3" /> Arquivada
          </span>
        )}
        {child && !c.archived && <span className="block text-xs text-muted-foreground">Subcategoria</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
    </Link>
  );
}

export default async function CategoriesPage({ searchParams }: PageProps<"/mais/categorias">) {
  const { ctx } = await requireHousehold();
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";
  const all = await listCategories(ctx, { includeArchived: showArchived });
  return (
    <>
      <PageHeader
        title="Categorias"
        backHref="/mais"
        description="As categorias formam o plano de contas do casal: indicam a finalidade de cada receita ou despesa."
        actions={
          <Button asChild size="icon" aria-label="Nova categoria">
            <Link href="/mais/categorias/nova">
              <Plus aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        <Group title="Despesas" items={all.filter((c) => c.kind === "EXPENSE")} all={all} />
        <Group title="Receitas" items={all.filter((c) => c.kind === "INCOME")} all={all} />
        <Link
          href={showArchived ? "/mais/categorias" : "/mais/categorias?arquivadas=1"}
          className="flex min-h-11 items-center justify-center text-sm font-medium text-primary"
        >
          {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
        </Link>
      </div>
    </>
  );
}
