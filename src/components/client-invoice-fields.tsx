"use client";

import { useState } from "react";
import { CfdiUseSelect } from "@/components/cfdi-use-select";
import { PaymentMethodSelect } from "@/components/payment-method-select";
import { RegimenSelect } from "@/components/regimen-select";
import { controlClass, Field } from "@/components/ui";

export function ClientInvoiceFields({
  defaultRequires = "",
  rfc = "",
  taxRegime = "",
  cfdiUse = "",
  paymentMethod = "",
  fiscalZip = "",
  fiscalAddress = "",
}: {
  defaultRequires?: string;
  rfc?: string;
  taxRegime?: string;
  cfdiUse?: string;
  paymentMethod?: string;
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
          <Field label="RFC"><input name="rfc" defaultValue={rfc} className={controlClass} /></Field>
          <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" defaultValue={taxRegime} /></Field>
          <Field label="Uso de CFDI" hint="Catálogo c_UsoCFDI del SAT."><CfdiUseSelect name="cfdiUse" defaultValue={cfdiUse} /></Field>
          <Field label="Método de pago" hint="PUE o PPD (c_MetodoPago)."><PaymentMethodSelect name="paymentMethod" defaultValue={paymentMethod} /></Field>
          <Field label="Código postal fiscal"><input name="fiscalZip" defaultValue={fiscalZip} className={controlClass} /></Field>
          <Field label="Domicilio fiscal (opcional)"><textarea name="fiscalAddress" defaultValue={fiscalAddress} className={controlClass} rows={2} /></Field>
        </>
      ) : (
        <>
          <input type="hidden" name="rfc" value={rfc} />
          <input type="hidden" name="taxRegime" value={taxRegime} />
          <input type="hidden" name="cfdiUse" value={cfdiUse} />
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
          <input type="hidden" name="fiscalZip" value={fiscalZip} />
          <input type="hidden" name="fiscalAddress" value={fiscalAddress} />
        </>
      )}
    </>
  );
}
