"use client";

import { useState } from "react";
import { controlClass, Field } from "@/components/ui";

export function ServiceTypePriority({
  types,
  priorities,
  hint,
}: {
  types: Array<{ value: string; label: string }>;
  priorities: Array<{ id: string; attentionType: string; label: string }>;
  hint?: string;
}) {
  const [type, setType] = useState("");
  const options = priorities.filter((row) => row.attentionType === type);
  return (
    <>
      <Field label="Tipo de atención" hint={hint}>
        <select name="attentionType" required className={controlClass} value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Selecciona</option>
          {types.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
      </Field>
      <Field label="Prioridad" hint={type ? "Solo las prioridades de este tipo de atención." : "Primero elige el tipo de atención."}>
        <select name="priorityId" required className={controlClass} disabled={!type}>
          <option value="">{type ? "Selecciona" : "Elige el tipo primero"}</option>
          {options.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </Field>
    </>
  );
}
