import { CfdiUseSelect } from "@/components/cfdi-use-select";
import { PaymentMethodSelect } from "@/components/payment-method-select";
import { Button, Field } from "@/components/ui";

type IssueAction = (formData: FormData) => void | Promise<void>;

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
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Uso de CFDI" className="min-w-[12rem]">
        <CfdiUseSelect name="cfdiUse" defaultValue={cfdiUse} required />
      </Field>
      <Field label="Método de pago" className="min-w-[10rem]">
        <PaymentMethodSelect name="paymentMethod" defaultValue={paymentMethod} required />
      </Field>
      <Button type="submit" tone={buttonTone}>{submitLabel}</Button>
    </form>
  );
}
