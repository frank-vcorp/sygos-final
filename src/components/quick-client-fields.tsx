"use client";

import { controlClass, Field } from "@/components/ui";

export function QuickClientFields({
  required = false,
  extended = true,
}: {
  required?: boolean;
  extended?: boolean;
}) {
  return (
    <>
      <Field label="Nombre o razón social">
        <input name="newClientName" className={controlClass} required={required} />
      </Field>
      <Field label="Nombre del contacto" hint="Obligatorio en alta rápida.">
        <input name="contactName" className={controlClass} required={required} />
      </Field>
      {extended ? (
        <>
          <Field label="Teléfono del contacto"><input name="contactPhone" className={controlClass} /></Field>
          <Field label="Correo del contacto"><input name="contactEmail" type="email" className={controlClass} /></Field>
        </>
      ) : null}
    </>
  );
}
