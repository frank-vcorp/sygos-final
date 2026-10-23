import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComprasRequerimientosPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/inicio");

  return (
    <>
      <PageHeader
        title="Requerimientos"
        subtitle="Solicitudes de compra y refacciones que el gerente convierte en pedido. Vista inicial: pendientes."
      />
      <Empty
        title="Sin requerimientos pendientes"
        body="Las solicitudes desde diagnóstico u orden de servicio aparecerán aquí. El módulo completo se está alineando con la fase 1 de Compras."
      />
    </>
  );
}
