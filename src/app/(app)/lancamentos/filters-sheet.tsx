"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Option = { id: string; name: string };

export function FiltersSheet({
  raw,
  categories,
  accounts,
  members,
  activeCount,
}: {
  raw: Record<string, string>;
  categories: (Option & { parentId: string | null; kind: string })[];
  accounts: Option[];
  members: { memberId: string; name: string }[];
  activeCount: number;
}) {
  const parents = categories.filter((c) => !c.parentId);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" aria-label={activeCount ? `Filtros (${activeCount} ativos)` : "Filtros"}>
          <SlidersHorizontal aria-hidden />
          Filtros{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader>
          <SheetTitle>Filtrar lançamentos</SheetTitle>
          <SheetDescription>Os filtros também valem para a exportação em CSV.</SheetDescription>
        </SheetHeader>
        <form action="/lancamentos" method="get" className="grid gap-4 px-4 pb-4">
          {raw.q && <input type="hidden" name="q" value={raw.q} />}
          {raw.mes && !raw.de && !raw.ate && <input type="hidden" name="mes" value={raw.mes} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="f-situacao">Situação</Label>
              <NativeSelect id="f-situacao" name="situacao" defaultValue={raw.situacao ?? ""}>
                <option value="">Todas</option>
                <option value="efetivado">Efetivados</option>
                <option value="pendente">Pendentes</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-tipo">Tipo</Label>
              <NativeSelect id="f-tipo" name="tipo" defaultValue={raw.tipo ?? ""}>
                <option value="">Todos</option>
                <option value="despesa">Despesas</option>
                <option value="receita">Receitas</option>
                <option value="transferencia">Transferências</option>
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="f-categoria">Categoria</Label>
            <NativeSelect id="f-categoria" name="categoria" defaultValue={raw.categoria ?? ""}>
              <option value="">Todas</option>
              {parents.map((p) => [
                <option key={p.id} value={p.id}>{p.name}{p.kind === "INCOME" ? " (receita)" : ""}</option>,
                ...categories
                  .filter((c) => c.parentId === p.id)
                  .map((c) => <option key={c.id} value={c.id}>{`   ${p.name} › ${c.name}`}</option>),
              ])}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="f-conta">Conta</Label>
              <NativeSelect id="f-conta" name="conta" defaultValue={raw.conta ?? ""}>
                <option value="">Todas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-pessoa">Responsável</Label>
              <NativeSelect id="f-pessoa" name="pessoa" defaultValue={raw.pessoa ?? ""}>
                <option value="">Todos</option>
                {members.map((m) => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
              </NativeSelect>
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Período personalizado (opcional)</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="f-de" className="text-muted-foreground">De</Label>
                <input id="f-de" type="date" name="de" defaultValue={raw.de ?? ""} className="h-11 w-full rounded-lg border border-input bg-card px-2 text-base" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="f-ate" className="text-muted-foreground">Até</Label>
                <input id="f-ate" type="date" name="ate" defaultValue={raw.ate ?? ""} className="h-11 w-full rounded-lg border border-input bg-card px-2 text-base" />
              </div>
            </div>
          </fieldset>

          <SheetFooter className="grid grid-cols-2 gap-2 p-0">
            <Button asChild variant="outline">
              <Link href="/lancamentos">Limpar</Link>
            </Button>
            <Button type="submit">Aplicar</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
