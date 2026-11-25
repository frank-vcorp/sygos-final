"use client";

import { useState } from "react";
import { controlClass } from "@/components/ui";

type Line = { id: string; concept: string; amount: number };

/** La nota sigue siendo por importe. Elegir una partida solo propone el monto de esa línea; se puede bajar. */
export function CreditNoteLineFields({
  lines,
  remaining,
  defaultConcept,
}: {
  lines: Line[];
  remaining: number;
  defaultConcept: string;
}) {
  const [concept, setConcept] = useState(defaultConcept);
  const [amount, setAmount] = useState(String(remaining));

  return (
    <>
      {lines.length > 0 ? (
        <label className="md:col-span-4">
          <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Partida que no salió (opcional)</span>
          <select
            className={controlClass}
            defaultValue=""
            onChange={(event) => {
              const line = lines.find((item) => item.id === event.target.value);
              if (!line) return;
              setConcept(line.concept);
              setAmount(String(line.amount));
            }}
          >
            <option value="">Importe libre, hasta el saldo acreditable</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.concept} · {line.amount}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Concepto de la nota de crédito</span>
        <input name="concept" required value={concept} onChange={(event) => setConcept(event.target.value)} className={controlClass} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Importe con IVA</span>
        <input name="amount" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className={controlClass} />
      </label>
    </>
  );
}
