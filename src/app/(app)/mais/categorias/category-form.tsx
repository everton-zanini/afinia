"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { ICONS } from "@/components/category-icon";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/category-style";
import { cn } from "@/lib/utils";
import { saveCategoryAction } from "@/server/actions/finance";
import type { CategoryDTO } from "@/server/finance/categories";

export function CategoryForm({
  category,
  parents,
  hasChildren = false,
}: {
  category?: CategoryDTO;
  parents: CategoryDTO[];
  hasChildren?: boolean;
}) {
  const [state, action] = useActionState(saveCategoryAction.bind(null, category?.id ?? null), { ok: false });
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">(category?.kind ?? "EXPENSE");
  const [color, setColor] = useState<string>(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState<string>(category?.icon ?? "tag");
  const e = state.fieldErrors ?? {};
  const parentOptions = parents.filter((p) => p.kind === kind && p.id !== category?.id && !p.archived);
  const Preview = ICONS[icon as keyof typeof ICONS];

  return (
    <ActionForm action={action} className="grid gap-4">
      <section className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            <Preview className="size-6" />
          </span>
          <Field label="Nome" name="name" defaultValue={category?.name} error={e.name} className="flex-1" />
        </div>

        {category ? (
          <input type="hidden" name="kind" value={kind} />
        ) : (
          <Segmented
            name="kind"
            legend="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "EXPENSE", label: "Despesa" },
              { value: "INCOME", label: "Receita" },
            ]}
          />
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="parentId">Categoria principal</Label>
          <NativeSelect id="parentId" name="parentId" defaultValue={category?.parentId ?? ""} disabled={hasChildren} key={kind}>
            <option value="">Nenhuma (é uma categoria principal)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
          {hasChildren && <p className="text-sm text-muted-foreground">Tem subcategorias, por isso continua principal.</p>}
          {hasChildren && <input type="hidden" name="parentId" value="" />}
          {e.parentId && <FieldError>{e.parentId}</FieldError>}
        </div>
      </section>

      <fieldset className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
        <legend className="float-left mb-1 font-semibold">Cor</legend>
        <div className="clear-both flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <label key={c} className="relative cursor-pointer rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" aria-label={`Cor ${c}`} />
              <span className="flex size-11 items-center justify-center rounded-full" style={{ backgroundColor: c }}>
                {color === c && <Check aria-hidden className="size-5 text-white" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
        <legend className="float-left mb-1 font-semibold">Ícone</legend>
        <div className="clear-both grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
          {CATEGORY_ICONS.map((name) => {
            const Icon = ICONS[name];
            return (
              <label
                key={name}
                className={cn(
                  "flex size-11 cursor-pointer items-center justify-center rounded-xl ring-1 ring-border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                  icon === name ? "bg-secondary text-primary ring-2 ring-primary" : "text-muted-foreground",
                )}
              >
                <input type="radio" name="icon" value={name} checked={icon === name} onChange={() => setIcon(name)} className="sr-only" aria-label={`Ícone ${name}`} />
                <Icon aria-hidden className="size-5" />
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormMessage ok={state.ok} message={state.message} />
      <SubmitButton size="lg">{category ? "Salvar alterações" : "Criar categoria"}</SubmitButton>
    </ActionForm>
  );
}
