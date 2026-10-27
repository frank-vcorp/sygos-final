"use client";

import { useMemo, useState } from "react";
import { Button, controlClass, Field } from "@/components/ui";

export type PurchaseLineDraft = {
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: string;
};

const emptyLine = (): PurchaseLineDraft => ({
  partNumber: "",
  description: "",
  quantity: 1,
  unitPrice: "",
});

export function PurchaseLinesField({
  requirePartNumber = true,
  showUnitPrice = false,
  compact = false,
}: {
  requirePartNumber?: boolean;
  showUnitPrice?: boolean;
  compact?: boolean;
}) {
  const [lines, setLines] = useState<PurchaseLineDraft[]>([emptyLine()]);

  const payload = useMemo(
    () =>
      lines.map((line) => ({
        partNumber: line.partNumber.trim(),
        description: line.description.trim(),
        quantity: Number(line.quantity) || 0,
        unitPrice: line.unitPrice.trim(),
      })),
    [lines],
  );

  const total = useMemo(() => {
    if (!showUnitPrice) return 0;
    return lines.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice.replace(/,/g, "")) || 0;
      return sum + qty * price;
    }, 0);
  }, [lines, showUnitPrice]);

  function update(index: number, patch: Partial<PurchaseLineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const gridCols = showUnitPrice
    ? "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.25rem_5.5rem_2.25rem]"
    : "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.25rem_2.25rem]";

  return (
    <div className="space-y-2">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      {showUnitPrice ? <input type="hidden" name="amount" value={total > 0 ? total.toFixed(2) : ""} /> : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink)]">Partidas</p>
        <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={() => setLines((current) => [...current, emptyLine()])}>
          + Partida
        </Button>
      </div>
      {compact ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <div className={`grid ${gridCols} min-w-[32rem] gap-2 border-b border-[var(--line)] bg-[#f8fbfd] px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]`}>
            <span>No. parte</span>
            <span>Descripción</span>
            <span>Cant.</span>
            {showUnitPrice ? <span>P. unit.</span> : null}
            <span aria-hidden />
          </div>
          {lines.map((line, index) => (
            <div key={index} className={`grid ${gridCols} min-w-[32rem] items-center gap-2 border-b border-[var(--line)] px-2 py-2 last:border-b-0`}>
              <input
                value={line.partNumber}
                onChange={(event) => update(index, { partNumber: event.target.value })}
                className={controlClass}
                required={requirePartNumber}
                placeholder="Parte"
                aria-label={`Número de parte ${index + 1}`}
              />
              <input
                value={line.description}
                onChange={(event) => update(index, { description: event.target.value })}
                className={controlClass}
                required={!requirePartNumber}
                placeholder="Descripción"
                aria-label={`Descripción ${index + 1}`}
              />
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) => update(index, { quantity: Number(event.target.value) })}
                className={controlClass}
                required
                aria-label={`Cantidad ${index + 1}`}
              />
              {showUnitPrice ? (
                <input
                  value={line.unitPrice}
                  onChange={(event) => update(index, { unitPrice: event.target.value })}
                  className={controlClass}
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  aria-label={`Precio unitario ${index + 1}`}
                />
              ) : null}
              <button
                type="button"
                className="min-h-9 rounded-md text-xs font-semibold text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)] disabled:opacity-40"
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                aria-label={`Quitar partida ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-[var(--line)] p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_5rem_7rem_auto] lg:items-end">
            <Field label="Número de parte">
              <input
                value={line.partNumber}
                onChange={(event) => update(index, { partNumber: event.target.value })}
                className={controlClass}
                required={requirePartNumber}
                aria-label={`Número de parte ${index + 1}`}
              />
            </Field>
            <Field label="Descripción">
              <input
                value={line.description}
                onChange={(event) => update(index, { description: event.target.value })}
                className={controlClass}
                required={!requirePartNumber}
                aria-label={`Descripción ${index + 1}`}
              />
            </Field>
            <Field label="Cantidad">
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) => update(index, { quantity: Number(event.target.value) })}
                className={controlClass}
                required
              />
            </Field>
            {showUnitPrice ? (
              <Field label="Precio unitario">
                <input
                  value={line.unitPrice}
                  onChange={(event) => update(index, { unitPrice: event.target.value })}
                  className={controlClass}
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  aria-label={`Precio unitario ${index + 1}`}
                />
              </Field>
            ) : null}
            <div className="flex justify-end sm:col-span-2 lg:col-span-1">
              <Button
                type="button"
                tone="ghost"
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                Quitar
              </Button>
            </div>
          </div>
        ))
      )}
      {showUnitPrice && total > 0 ? (
        <p className="text-right text-sm text-[var(--muted)]">
          Total: <strong className="text-[var(--ink)]">${total.toFixed(2)}</strong>
        </p>
      ) : null}
    </div>
  );
}
