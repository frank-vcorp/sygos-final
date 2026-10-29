import { redirect } from "next/navigation";
import { RegisterPaymentDialog } from "../register-payment-dialog";
import { getPaymentFormOptions } from "../payment-form-data";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoPagoPage() {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect("/inicio");
  const { receivables, payables } = await getPaymentFormOptions(session);

  return (
    <>
      <PageHeader
        back={{ href: "/pagos", label: "Pagos" }}
        title="Registrar pago"
        subtitle="El vendedor lo deja pendiente. Coordinación, CEO o Administrador pueden dejarlo validado."
      />
      <RegisterPaymentDialog
        receivables={receivables}
        payables={payables}
        initiallyOpen
        showTrigger={false}
        returnHref="/pagos"
      />
    </>
  );
}
