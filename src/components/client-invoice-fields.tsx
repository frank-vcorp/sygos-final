"use client";

import { useState } from "react";
import { RegimenSelect } from "@/components/regimen-select";
import { controlClass, Field } from "@/components/ui";

export function ClientInvoiceFields({
  defaultRequires = "",
  rfc = "",
  taxRegime = "",
  fiscalZip = "",
  fiscalAddress = "",
}: {
  defaultRequires?: string;
  rfc?: string;
  taxRegime?: string;
  fiscalZip?: string;
  fiscalAddress?: string;
}) {
  const [requires, setRequires] = useState(defaultRequires);
  const show = requires === "si";
  return (
    <>
      <Field label="Requiere factura" hint="Si elige Sí, los datos fiscales se capturan en este momento.">
        <select name="requiresInvoice" className={controlClass} value={requires} onChange={(event) => setRequires(event.target.value)}>
          <option value="">Sin definir</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </Field>
      {show ? (
        <>
          <Field label="RFC"><input name="rfc" required defaultValue={rfc} className={controlClass} /></Field>
          <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" required defaultValue={taxRegime} /></Field>
          <Field label="Código postal fiscal"><input name="fiscalZip" required defaultValue={fiscalZip} className={controlClass} /></Field>
          <Field label="Domicilio fiscal"><textarea name="fiscalAddress" required defaultValue={fiscalAddress} className={controlClass} rows={2} /></Field>
        </>
      ) : (
        <>
          <input type="hidden" name="rfc" value={rfc} />
          <input type="hidden" name="taxRegime" value={taxRegime} />
          <input type="hidden" name="fiscalZip" value={fiscalZip} />
          <input type="hidden" name="fiscalAddress" value={fiscalAddress} />
        </>
      )}
    </>
  );
}
