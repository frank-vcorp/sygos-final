"use client";

import { useState } from "react";
import { Button, controlClass, Field } from "@/components/ui";
import {
  DEFAULT_QUOTE_LINE_CONDITION,
  QUOTE_LINE_CONDITIONS,
  QUOTE_LINE_CONDITION_LABEL,
  type QuoteLineCondition,
} from "@/lib/quote-line-condition";

type DraftLine = {
  concept: string;
  quantity: number;
  unitPrice: string;
  lineCondition: QuoteLineCondition;
};

function emptyLine(): DraftLine {
  return { concept: "", quantity: 1, unitPrice: "", lineCondition: DEFAULT_QUOTE_LINE_CONDITION };
}

export function QuoteSaleLinesFields() {
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  }

  return (
    <div className="grid gap-3">
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-[var(--line)] bg-[#f9fbfd] p-3 sm:grid-cols-2">
          <Field label={lines.length === 1 ? "Concepto" : `Concepto ${index + 1}`} hint="Equipo, refacción o accesorio.">
            <input
              name="saleLineConcept"
              className={controlClass}
              required
              value={line.concept}
              onChange={(event) => updateLine(index, { concept: event.target.value })}
              placeholder="Ej. Variador ABB ACS580"
            />
          </Field>
          <Field label="Condición" hint="Estado del bien ofrecido.">
            <select
              name="saleLineCondition"
              className={controlClass}
              required
              value={line.lineCondition}
              onChange={(event) => updateLine(index, { lineCondition: event.target.value as QuoteLineCondition })}
            >
              {QUOTE_LINE_CONDITIONS.map((code) => (
                <option key={code} value={code}>{QUOTE_LINE_CONDITION_LABEL[code]}</option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad">
            <input
              name="saleLineQty"
              type="number"
              min={1}
              step={1}
              className={controlClass}
              required
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 1 })}
            />
          </Field>
          <Field label="Precio unitario" hint="Importe antes de IVA; moneda MXN.">
            <input
              name="saleLinePrice"
              type="text"
              inputMode="decimal"
              className={controlClass}
              required
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
              placeholder="0.00"
            />
          </Field>
          {lines.length > 1 ? (
            <div className="sm:col-span-2 flex justify-end">
              <Button type="button" tone="ghost" onClick={() => removeLine(index)}>Quitar línea</Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button type="button" tone="ghost" onClick={addLine}>Agregar otra línea</Button>
    </div>
  );
}