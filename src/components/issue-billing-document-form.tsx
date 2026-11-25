"use client";

import { useState } from "react";
import { CfdiUseSelect } from "@/components/cfdi-use-select";
import { PaymentFormSelect } from "@/components/payment-form-select";
import { PaymentMethodSelect } from "@/components/payment-method-select";
import { Button } from "@/components/ui";

type IssueAction = (formData: FormData) => void | Promise<void>;

function FiscalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

export function IssueBillingDocumentForm({
  documentId,
  submitLabel,
  action,
  cfdiUse,
  paymentMethod,
  paymentForm = "03",
  buttonTone,
  issueBlockedMessage,
}: {
  documentId: string;
  submitLabel: string;
  action: IssueAction;
  cfdiUse: string;
  paymentMethod: string;
  paymentForm?: string;
  buttonTone?: "ghost";
  issueBlockedMessage?: string | null;
}) {
  const issueBlocked = Boolean(issueBlockedMessage);
  const [method, setMethod] = useState(paymentMethod);
  const [form, setForm] = useState(paymentForm && paymentForm !== "99" ? paymentForm : "03");

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="documentId" value={documentId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,1fr)_auto] lg:items-end">
        <FiscalField label="Uso de CFDI">
          <CfdiUseSelect name="cfdiUse" defaultValue={cfdiUse} required />
        </FiscalField>
        <FiscalField label="Método de pago">
          <PaymentMethodSelect
            name="paymentMethod"
            value={method}
            onChange={(next) => setMethod(next)}
            required
          />
        </FiscalField>
        <FiscalField label="Forma de pago (c_FormaPago)">
          <PaymentFormSelect
            name="paymentForm"
            paymentMethod={method}
            value={form}
            onChange={(next) => setForm(next)}
            required
          />
        </FiscalField>
        <div className="flex w-full flex-col gap-1.5 lg:w-auto lg:justify-self-end">
          {issueBlockedMessage ? (
            <p className="text-xs font-medium text-[var(--warn)] lg:max-w-xs lg:text-right">{issueBlockedMessage}</p>
          ) : null}
          <Button
            type="submit"
            tone={buttonTone}
            disabled={issueBlocked}
            className="w-full shrink-0 lg:w-auto"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
