"use client";

import { useState } from "react";
import { controlClass, Field } from "@/components/ui";
import {
  DEFAULT_QUOTE_PAYMENT_CONDITION,
  DEFAULT_QUOTE_WARRANTY_MONTHS,
  isQuotePaymentCondition,
  QUOTE_PAYMENT_CONDITION_LABEL,
  QUOTE_PAYMENT_CONDITIONS,
  type QuotePaymentCondition,
  QUOTE_WARRANTY_MONTHS,
  quoteCreditDaysFieldValue,
} from "@/lib/quote-commercial-terms";

type QuoteCommercialTermsFieldsProps = {
  variant?: "field" | "inline";
  defaultWarrantyMonths?: number | null;
  defaultPaymentCondition?: string | null;
  defaultCreditDays?: number | null;
};

function initialPayment(defaultPaymentCondition: string | null | undefined): QuotePaymentCondition {
  const value = defaultPaymentCondition ?? DEFAULT_QUOTE_PAYMENT_CONDITION;
  return isQuotePaymentCondition(value) ? value : DEFAULT_QUOTE_PAYMENT_CONDITION;
}

export function QuoteCommercialTermsFields({
  variant = "field",
  defaultWarrantyMonths,
  defaultPaymentCondition,
  defaultCreditDays,
}: QuoteCommercialTermsFieldsProps) {
  const warrantyValue = String(defaultWarrantyMonths ?? DEFAULT_QUOTE_WARRANTY_MONTHS);
  const [paymentCondition, setPaymentCondition] = useState<QuotePaymentCondition>(() =>
    initialPayment(defaultPaymentCondition),
  );
  const [creditDays, setCreditDays] = useState(() =>
    quoteCreditDaysFieldValue(initialPayment(defaultPaymentCondition), defaultCreditDays),
  );

  const onPaymentChange = (next: QuotePaymentCondition) => {
    setPaymentCondition(next);
    if (next === "CREDITO") {
      setCreditDays((prev) => (prev.trim() ? prev : quoteCreditDaysFieldValue("CREDITO", null)));
    }
  };

  const showCreditDays = paymentCondition === "CREDITO";

  const warrantySelect = (
    <select
      name="warrantyMonths"
      className={controlClass}
      required
      defaultValue={warrantyValue}
      aria-label="Meses de garantía"
    >
      {QUOTE_WARRANTY_MONTHS.map((months) => (
        <option key={months} value={months}>
          {months} meses
        </option>
      ))}
    </select>
  );

  const paymentSelect = (
    <select
      name="paymentCondition"
      className={controlClass}
      required
      value={paymentCondition}
      onChange={(event) => {
        const value = event.target.value;
        if (isQuotePaymentCondition(value)) onPaymentChange(value);
      }}
      aria-label="Condiciones de pago"
    >
      {QUOTE_PAYMENT_CONDITIONS.map((code) => (
        <option key={code} value={code}>
          {QUOTE_PAYMENT_CONDITION_LABEL[code]}
        </option>
      ))}
    </select>
  );

  const creditInput = (
    <input
      name="creditDays"
      type="number"
      min={1}
      step={1}
      className={controlClass}
      value={creditDays}
      onChange={(event) => setCreditDays(event.target.value)}
      required={showCreditDays}
      disabled={!showCreditDays}
      aria-label="Días de crédito"
      placeholder="30"
    />
  );

  if (variant === "inline") {
    return (
      <>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-[var(--muted)]">Garantía</span>
          {warrantySelect}
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-[var(--muted)]">Condiciones de pago</span>
          {paymentSelect}
        </label>
        {showCreditDays ? (
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">Días de crédito</span>
            {creditInput}
          </label>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Field label="Garantía" hint="Meses de garantía del servicio o equipo cotizado.">
        {warrantySelect}
      </Field>
      <Field label="Condiciones de pago" hint="Define cómo se espera el cobro al autorizar.">
        {paymentSelect}
      </Field>
      {showCreditDays ? (
        <Field label="Días de crédito" hint="Plazo de cobro cuando la condición es Crédito.">
          {creditInput}
        </Field>
      ) : null}
    </>
  );
}