import { CfdiUseSelect } from "@/components/cfdi-use-select";
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
  buttonTone,
}: {
  documentId: string;
  submitLabel: string;
  action: IssueAction;
  cfdiUse: string;
  paymentMethod: string;
  buttonTone?: "ghost";
}) {
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="documentId" value={documentId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_auto] lg:items-end">
        <FiscalField label="Uso de CFDI">
          <CfdiUseSelect name="cfdiUse" defaultValue={cfdiUse} required />
        </FiscalField>
        <FiscalField label="Método de pago">
          <PaymentMethodSelect name="paymentMethod" defaultValue={paymentMethod} required />
        </FiscalField>
        <Button type="submit" tone={buttonTone} className="w-full shrink-0 lg:w-auto lg:justify-self-end">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
