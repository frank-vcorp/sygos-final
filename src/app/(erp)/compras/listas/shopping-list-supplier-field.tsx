"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setShoppingListSupplierSilentAction } from "../actions";
import { controlClass } from "@/components/ui";

export function ShoppingListSupplierField({
  listId,
  supplierId,
  suppliers,
}: {
  listId: string;
  supplierId: string | null;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const savedRef = useRef(supplierId ?? "");
  const [value, setValue] = useState(supplierId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: string) {
    if (next === savedRef.current) return;
    setSaving(true);
    setError(null);
    const result = await setShoppingListSupplierSilentAction(listId, next || null);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "No se pudo guardar el proveedor.");
      setValue(savedRef.current);
      return;
    }
    savedRef.current = next;
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Cambiar proveedor</span>
        <select
          name="supplierId"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            void persist(next);
          }}
          className={controlClass}
        >
          <option value="">Sin proveedor por ahora</option>
          {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {saving ? <p className="mt-1 text-xs text-[var(--muted)]">Guardando…</p> : null}
      {error ? <p className="mt-1 text-xs text-[var(--danger)]" role="alert">{error}</p> : null}
    </div>
  );
}
