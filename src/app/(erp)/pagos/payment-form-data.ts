import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { requireCompany } from "@/lib/session";

export type PaymentReceivableOption = {
  id: string;
  balance: number;
  documentFolio: string;
  clientName: string;
  clientIsSystem: boolean;
};

export type PaymentPayableOption = {
  id: string;
  balance: number;
  documentFolio: string | null;
};

export async function getPaymentFormOptions(session: Awaited<ReturnType<typeof requireCompany>>) {
  const receivables = await prisma.receivable.findMany({
    where: {
      companyId: session.activeCompanyId,
      balance: { gt: 0 },
      ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}),
    },
    include: { client: true, document: true },
    orderBy: { dueAt: "asc" },
  });
  const payables =
    session.activeCompanyCode === "SYSTRON" && can(session.role, "payment.validate", session.activeCompanyCode)
      ? await prisma.payable.findMany({
          where: { companyId: session.activeCompanyId, balance: { gt: 0 } },
          include: { document: true },
        })
      : [];

  return {
    receivables: receivables.map((row) => ({
      id: row.id,
      balance: row.balance,
      documentFolio: row.document.folio,
      clientName: row.client.name,
      clientIsSystem: row.client.isSystem,
    })),
    payables: payables.map((row) => ({
      id: row.id,
      balance: row.balance,
      documentFolio: row.document?.folio ?? null,
    })),
  };
}
