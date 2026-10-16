"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { discountAction } from "@/app/(erp)/cotizaciones/actions";
import { QuoteDecisionActions } from "@/components/quote-decision-actions";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

type DecideAction = (formData: FormData) => void | Promise<void>;

type QuoteLine = { id: string; concept: string };

type SellerDecisionContextValue = {
  quoteId: string;
  version: number;
  quoteType: string;
  lines: QuoteLine[];
  discountPct: string;
  setDiscountPct: (value: string) => void;
  discountLimitPct: number | null;
  decideAction: DecideAction;
  discountAction: typeof discountAction;
};

const SellerDecisionContext = createContext<SellerDecisionContextValue | null>(null);

function useSellerDecision() {
  const value = useContext(SellerDecisionContext);
  if (!value) throw new Error("QuoteSellerDecisionRoot is required.");
  return value;
}

function parsedDiscountPct(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function QuoteSellerDecisionRoot({
  children,
  quoteId,
  version,
  quoteType,
  lines,
  initialDiscountPct,
  discountLimitPct,
  decideAction,
  discountAction: applyDiscountAction,
}: {
  children: React.ReactNode;
  quoteId: string;
  version: number;
  quoteType: string;
  lines: QuoteLine[];
  initialDiscountPct: number;
  discountLimitPct: number | null;
  decideAction: DecideAction;
  discountAction: typeof discountAction;
}) {
  const [discountPct, setDiscountPct] = useState(String(initialDiscountPct));
  const value = useMemo(
    () => ({
      quoteId,
      version,
      quoteType,
      lines,
      discountPct,
      setDiscountPct,
      discountLimitPct,
      decideAction,
      discountAction: applyDiscountAction,
    }),
    [quoteId, version, quoteType, lines, discountPct, discountLimitPct, decideAction, applyDiscountAction],
  );
  return <SellerDecisionContext.Provider value={value}>{children}</SellerDecisionContext.Provider>;
}

export function QuoteSellerDecisionHeaderActions() {
  const { quoteId, version, quoteType, lines, discountPct, decideAction } = useSellerDecision();
  return (
    <QuoteDecisionActions
      quoteId={quoteId}
      version={version}
      quoteType={quoteType}
      lines={lines}
      decideAction={decideAction}
      discountPct={parsedDiscountPct(discountPct)}
    />
  );
}

export function QuoteSellerDecisionDiscountPanel() {
  const { quoteId, version, discountPct, setDiscountPct, discountLimitPct, discountAction } = useSellerDecision();
  return (
    <FormPanel action={discountAction}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="version" value={version} />
      <FormSection title="Descuento" columns={1}>
        <Field
          label="Porcentaje"
          hint={
            discountLimitPct != null
              ? `Tu límite es ${discountLimitPct}%. Al autorizar se aplica el porcentaje actual si no pulsaste Aplicar.`
              : "Tu usuario no tiene tope configurado; solo puedes dejar 0% hasta que administración asigne un límite."
          }
        >
          <input
            name="discountPct"
            required
            value={discountPct}
            onChange={(event) => setDiscountPct(event.target.value)}
            className={controlClass}
          />
        </Field>
      </FormSection>
      <FormActions><SubmitButton tone="ghost">Aplicar</SubmitButton></FormActions>
    </FormPanel>
  );
}
