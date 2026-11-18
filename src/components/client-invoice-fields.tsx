"use client";

import { useState } from "react";
import { CfdiUseSelect } from "@/components/cfdi-use-select";
import { PaymentMethodSelect } from "@/components/payment-method-select";
import { RegimenSelect } from "@/components/regimen-select";
import { Button, controlClass, Field } from "@/components/ui";
import { stripCorporateRegimeSuffix } from "@/lib/sat-legal-name";

export function ClientInvoiceFields({
  defaultRequires = "",
  rfc = "",
  satLegalName = "",
  taxRegime = "",
  cfdiUse = "",
  paymentMethod = "",
  fiscalZip = "",
  fiscalAddress = "",
  fiscalEmail = "",
}: {
  defaultRequires?: string;
  rfc?: string;
  satLegalName?: string;
  taxRegime?: string;
  cfdiUse?: string;
  paymentMethod?: string;
  fiscalZip?: string;
  fiscalAddress?: string;
  fiscalEmail?: string;
}) {
  const [requires, setRequires] = useState(defaultRequires);
  const [satName, setSatName] = useState(satLegalName);
  const show = requires === "si";

  function suggestFromFormName(button: HTMLButtonElement) {
    const form = button.form;
    const nameInput = form?.elements.namedItem("name") as HTMLInputElement | null;
    const source = satName.trim() || nameInput?.value || "";
    const suggested = stripCorporateRegimeSuffix(source);
    if (suggested) setSatName(suggested);
  }

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
          <div className="md:col-span-2">
            <Field
              label="Razón social SAT (sin régimen societario)"
              hint="CFDI 4.0 exige el nombre exacto de la Constancia de Situación Fiscal sin S.A. de C.V., S. de R.L., etc. Si queda vacío, se usa el nombre sin sufijo societario."
            >
              <div className="flex flex-wrap gap-2">
                <input
                  name="satLegalName"
                  value={satName}
                  onChange={(event) => setSatName(event.target.value)}
                  placeholder="Ej. ACEROS DEL NORTE"
                  className={`${controlClass} min-w-0 flex-1`}
                />
                <Button
                  type="button"
                  tone="ghost"
                  className="shrink-0 text-xs"
                  onClick={(event) => suggestFromFormName(event.currentTarget)}
                >
                  Quitar S.A. de C.V.
                </Button>
              </div>
            </Field>
          </div>
          <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" defaultValue={taxRegime} /></Field>
          <Field label="Uso de CFDI" hint="Catálogo c_UsoCFDI del SAT."><CfdiUseSelect name="cfdiUse" defaultValue={cfdiUse} /></Field>
          <Field label="Método de pago" hint="PUE o PPD (c_MetodoPago)."><PaymentMethodSelect name="paymentMethod" defaultValue={paymentMethod} /></Field>
          <Field label="Código postal fiscal"><input name="fiscalZip" defaultValue={fiscalZip} className={controlClass} /></Field>
          <Field label="Correo fiscal para XML/PDF (opcional)" hint="Si queda vacío se usa el correo del contacto principal.">
            <input name="fiscalEmail" type="email" defaultValue={fiscalEmail} placeholder="facturacion@cliente.com" className={controlClass} />
          </Field>
          <Field label="Domicilio fiscal (opcional)"><textarea name="fiscalAddress" defaultValue={fiscalAddress} className={controlClass} rows={2} /></Field>
        </>
      ) : (
        <>
          <input type="hidden" name="rfc" value={rfc} />
          <input type="hidden" name="satLegalName" value={satName} />
          <input type="hidden" name="taxRegime" value={taxRegime} />
          <input type="hidden" name="cfdiUse" value={cfdiUse} />
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
          <input type="hidden" name="fiscalZip" value={fiscalZip} />
          <input type="hidden" name="fiscalAddress" value={fiscalAddress} />
          <input type="hidden" name="fiscalEmail" value={fiscalEmail} />
        </>
      )}
    </>
  );
}
