"use client";

import { useRouter } from "next/navigation";
import { IMPORT_CATALOG, IMPORT_GROUPS, IMPORT_KINDS, type ImportKind } from "@/lib/product/import-catalog";

export function ImportKindSelect({ value }: { value: ImportKind }) {
  const router = useRouter();
  return (
    <select
      name="kind"
      value={value}
      onChange={(event) => router.replace(`/configuracion/importar?kind=${event.target.value}#preparar`, { scroll: true })}
    >
      {IMPORT_GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {IMPORT_KINDS.filter((kind) => IMPORT_CATALOG[kind].group === group).map((kind) => <option key={kind} value={kind}>{IMPORT_CATALOG[kind].label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
