import { controlClass, Field } from "@/components/ui";
import {
  DEFAULT_QUOTE_PAYMENT_CONDITION,
  DEFAULT_QUOTE_WARRANTY_MONTHS,
  QUOTE_PAYMENT_CONDITION_LABEL,
  QUOTE_PAYMENT_CONDITIONS,
  QUOTE_WARRANTY_MONTHS,
} from "@/lib/quote-commercial-terms";

type QuoteCommercialTermsFieldsProps = {
  variant?: "field" | "inline";
  defaultWarrantyMonths?: number | null;
  defaultPaymentCondition?: string | null;
  defaultCreditDays?: number | null;
};

export function QuoteCommercialTermsFields({
  variant = "field",
  defaultWarrantyMonths,
  defaultPaymentCondition,
  defaultCreditDays,
}: QuoteCommercialTermsFieldsProps) {
  const warrantyValue = String(defaultWarrantyMonths ?? DEFAULT_QUOTE_WARRANTY_MONTHS);
  const paymentValue = defaultPaymentCondition ?? DEFAULT_QUOTE_PAYMENT_CONDITION;
  const creditValue = defaultCreditDays != null && defaultCreditDays > 0 ? String(defaultCreditDays) : "";

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
      defaultValue={paymentValue}
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
      defaultValue={creditValue}
      aria-label="Días de crédito"
      placeholder="Ej. 30"
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
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-[var(--muted)]">Días de crédito · si aplica</span>
          {creditInput}
        </label>
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
      <Field label="Días de crédito" hint="Obligatorio si la condición de pago es Crédito.">
        {creditInput}
      </Field>
    </>
  );
}