"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { removeShoppingListLineAction, updateShoppingListLineSilentAction } from "../actions";
import { Button, controlClass, Td } from "@/components/ui";
import { requirementPartidaLabel } from "@/lib/requirement-display";

type LineValues = {
  partNumber: string;
  description: string;
  quantity: number;
};

export function ShoppingListLineRow({
  listId,
  lineId,
  origin,
  initial,
  open,
}: {
  listId: string;
  lineId: string;
  origin: string;
  initial: LineValues;
  open: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const savedRef = useRef(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(async () => {
    const next = values;
    if (
      next.partNumber === savedRef.current.partNumber
      && next.description === savedRef.current.description
      && next.quantity === savedRef.current.quantity
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateShoppingListLineSilentAction({
      listId,
      lineId,
      partNumber: next.partNumber,
      description: next.description,
      quantity: next.quantity,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "No se pudo guardar.");
      return;
    }
    savedRef.current = next;
    router.refresh();
  }, [lineId, listId, router, values]);

  const onFieldBlur = () => {
    void persist();
  };

  if (!open) {
    return (
      <tr>
        <Td>{initial.quantity}</Td>
        <Td>{origin}</Td>
        <Td>{requirementPartidaLabel({ partNumber: initial.partNumber, description: initial.description })}</Td>
      </tr>
    );
  }

  return (
    <tr>
      <Td>
        <input
          name="quantity"
          type="number"
          min={1}
          value={values.quantity}
          onChange={(event) => setValues((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
          onBlur={onFieldBlur}
          className={`${controlClass} w-20`}
          aria-label="Cantidad"
        />
      </Td>
      <Td>{origin}</Td>
      <Td>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="partNumber"
            value={values.partNumber}
            onChange={(event) => setValues((prev) => ({ ...prev, partNumber: event.target.value }))}
            onBlur={onFieldBlur}
            className={controlClass}
            aria-label="Número de parte"
          />
          <input
            name="description"
            value={values.description}
            onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            onBlur={onFieldBlur}
            className={controlClass}
            aria-label="Descripción"
          />
        </div>
        {error ? <p className="mt-1 text-xs text-[var(--danger)]" role="alert">{error}</p> : null}
        {saving ? <p className="mt-1 text-xs text-[var(--muted)]">Guardando…</p> : null}
      </Td>
      <Td>
        <form action={removeShoppingListLineAction}>
          <input type="hidden" name="listId" value={listId} />
          <input type="hidden" name="lineId" value={lineId} />
          <Button type="submit" tone="ghost">Quitar</Button>
        </form>
      </Td>
    </tr>
  );
}
