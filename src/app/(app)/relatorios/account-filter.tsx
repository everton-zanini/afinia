"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";

export function AccountFilter({
  accounts,
  value,
  baseQuery,
}: {
  accounts: { id: string; name: string; archived: boolean }[];
  value: string;
  baseQuery: string;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="rel-conta" className="text-sm text-muted-foreground">Conta</Label>
      <NativeSelect
        id="rel-conta"
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(baseQuery);
          if (e.target.value) params.set("conta", e.target.value);
          else params.delete("conta");
          router.push(`/relatorios?${params.toString()}`);
        }}
      >
        <option value="">Todas as contas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.archived ? " (arquivada)" : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
