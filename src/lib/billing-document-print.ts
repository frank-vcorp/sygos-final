import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadBillingDocumentServiceLinksForDocument } from "@/lib/billing-document-service-links";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export async function loadBillingDocumentForPrint(
  id: string,
  options: { kind?: "REMISION" | "FACTURA" | "FACTURA_LIBRE" | "FACTURA_INTERCOMPANIA" | "NOTA_CREDITO" } = {},
) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) {
    redirect("/inicio");
  }
  const row = await prisma.billingDocument.findFirst({
    where: {
      id,
      companyId: session.activeCompanyId,
      ...(options.kind ? { kind: options.kind } : {}),
    },
    include: {
      company: true,
      client: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
      quote: {
        select: {
          id: true,
          folio: true,
          reference: true,
          warrantyMonths: true,
          paymentCondition: true,
          creditDays: true,
          technicalCaseId: true,
        },
      },
      lines: true,
    },
  });
  if (!row) notFound();
  const serviceLinks = await loadBillingDocumentServiceLinksForDocument(row, session.activeCompanyId);
  return { session, row, serviceLinks };
}

export function billingDocumentIssuedLabel(row: { issuedAt: Date | null; createdAt: Date }): string {
  const when = row.issuedAt ?? row.createdAt;
  return when.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });
}

export function billingMetaRefs(
  row: { folio: string; quote?: { folio: string } | null },
  serviceLinks: { diagnosisFolio: string | null; osFolio: string | null },
): string[] {
  const parts: string[] = [];
  if (row.quote?.folio) parts.push(`Cotización ${row.quote.folio}`);
  if (serviceLinks.osFolio) parts.push(`OS ${serviceLinks.osFolio}`);
  if (serviceLinks.diagnosisFolio) parts.push(`DX ${serviceLinks.diagnosisFolio}`);
  return parts;
}