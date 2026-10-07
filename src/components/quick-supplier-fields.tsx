"use client";

import { controlClass, Field } from "@/components/ui";

export function QuickSupplierFields({ required = false }: { required?: boolean }) {
  return (
    <>
      <Field label="Nombre o razón social">
        <input name="newSupplierName" className={controlClass} required={required} />
      </Field>
      <Field label="Contacto"><input name="supplierContactName" className={controlClass} /></Field>
      <Field label="Teléfono"><input name="supplierPhone" className={controlClass} /></Field>
      <Field label="Correo"><input name="supplierEmail" type="email" className={controlClass} /></Field>
    </>
  );
}
