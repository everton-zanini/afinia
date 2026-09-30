import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmAction } from "@/components/confirm-action";
import { NotFoundError } from "@/server/errors";
import { getCategory, listCategories } from "@/server/finance/categories";
import { archiveCategoryAction, deleteCategoryAction } from "@/server/actions/finance";
import { requireHousehold } from "@/server/session";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Editar categoria" };

export default async function EditCategoryPage({ params }: PageProps<"/mais/categorias/[id]">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const category = await getCategory(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const all = await listCategories(ctx, { includeArchived: true });
  const hasChildren = all.some((c) => c.parentId === id);
  const archive = archiveCategoryAction.bind(null, id, !category.archived);
  const remove = deleteCategoryAction.bind(null, id);

  return (
    <>
      <PageHeader
        title={category.name}
        backHref="/mais/categorias"
        description={category.kind === "EXPENSE" ? "Categoria de despesa" : "Categoria de receita"}
      />
      <div className="grid gap-4">
        <CategoryForm category={category} parents={all.filter((c) => !c.parentId)} hasChildren={hasChildren} />
        <section className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-semibold">Arquivar ou excluir</h2>
          <p className="text-sm text-muted-foreground">
            Categorias usadas não podem ser excluídas: arquive para escondê-las dos novos lançamentos e manter o histórico.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ConfirmAction
              action={archive}
              title={category.archived ? "Reativar categoria?" : "Arquivar categoria?"}
              description={
                category.archived
                  ? "Ela voltará a aparecer nos novos lançamentos."
                  : "Ela deixará de aparecer nos novos lançamentos. Subcategorias também serão arquivadas."
              }
              confirmLabel={category.archived ? "Reativar" : "Arquivar"}
            >
              {category.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {category.archived ? "Reativar" : "Arquivar"}
            </ConfirmAction>
            <ConfirmAction
              action={remove}
              title="Excluir categoria?"
              description="Só é possível excluir categorias nunca usadas e sem subcategorias. Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
              variant="destructive"
              destructive
            >
              <Trash2 aria-hidden />
              Excluir
            </ConfirmAction>
          </div>
        </section>
      </div>
    </>
  );
}
