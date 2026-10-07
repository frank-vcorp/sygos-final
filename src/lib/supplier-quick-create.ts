import { prisma } from "@/lib/db";
import { recordHistory } from "@/lib/history";

type QuickSupplierActor = {
  userId: string;
  activeCompanyId: string;
};

export async function quickCreateSupplier(
  actor: QuickSupplierActor,
  input: {
    name: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
  },
) {
  const supplier = await prisma.supplier.create({
    data: {
      companyId: actor.activeCompanyId,
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PROVEEDOR",
    entityId: supplier.id,
    action: "ALTA",
    summary: "Alta rápida de proveedor desde un proceso operativo.",
    authorUserId: actor.userId,
  });
  return { supplierId: supplier.id };
}

export async function resolveSupplierIdForProcess(
  actor: QuickSupplierActor,
  input: {
    supplierId: string | null;
    newSupplierName: string | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
  },
) {
  if (input.supplierId) return { supplierId: input.supplierId };
  if (!input.newSupplierName?.trim()) {
    throw new Error("Elige un proveedor o indica su nombre en el alta rápida.");
  }
  const created = await quickCreateSupplier(actor, {
    name: input.newSupplierName,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
  });
  return { supplierId: created.supplierId };
}
