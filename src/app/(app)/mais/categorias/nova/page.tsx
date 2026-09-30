import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { listCategories } from "@/server/finance/categories";
import { requireHousehold } from "@/server/session";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Nova categoria" };

export default async function NewCategoryPage() {
  const { ctx } = await requireHousehold();
  const parents = (await listCategories(ctx)).filter((c) => !c.parentId);
  return (
    <>
      <PageHeader title="Nova categoria" backHref="/mais/categorias" />
      <CategoryForm parents={parents} />
    </>
  );
}
