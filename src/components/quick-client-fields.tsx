"use client";

import { controlClass, Field } from "@/components/ui";

export function QuickClientFields({
  required = false,
  extended = true,
  defaultName = "",
}: {
  required?: boolean;
  extended?: boolean;
  defaultName?: string;
}) {
  return (
    <>
      <Field label="Nombre o razón social">
        <input name="newClientName" className={controlClass} required={required} defaultValue={defaultName} />
      </Field>
      <Field label="Nombre del contacto" hint="Obligatorio en alta rápida.">
        <input name="contactName" className={controlClass} required={required} />
      </Field>
      <Field label="Teléfono del contacto" hint="Obligatorio en alta rápida.">
        <input name="contactPhone" type="tel" className={controlClass} required={required} />
      </Field>
      {extended ? <Field label="Correo del contacto"><input name="contactEmail" type="email" className={controlClass} /></Field> : null}
    </>
  );
}
