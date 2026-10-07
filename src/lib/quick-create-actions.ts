"use server";

import { quickCreateClient } from "@/lib/client-quick-create";
import { prisma } from "@/lib/db";
import { createEqui, createMotIdentity } from "@/lib/equipment-service";
import {
  validateQuickClientDraft,
  validateQuickEquipmentDraft,
  validateQuickSupplierDraft,
  type QuickFormFieldMap,
} from "@/lib/quick-form-persist";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { quickCreateSupplier } from "@/lib/supplier-quick-create";

function catalogFromFields(fields: QuickFormFieldMap) {
  const typeName = fields.newType?.trim() || fields.typeName?.trim() || "";
  const brandName = fields.newBrand?.trim() || fields.brandName?.trim() || "";
  const model = fields.model?.trim() || "";
  if (!typeName || !brandName) {
    throw new Error("Indica tipo y marca del equipo.");
  }
  return { typeName, brandName, model, serial: fields.serial?.trim() || null };
}

export async function quickCreateClientAction(fields: QuickFormFieldMap) {
  const session = await requireCompany();
  if (!can(session.role, "client.create", session.activeCompanyCode)) {
    throw new Error("No tienes permiso para dar de alta un cliente.");
  }
  const message = validateQuickClientDraft(fields);
  if (message) throw new Error(message);
  const created = await quickCreateClient(session, {
    name: fields.newClientName,
    contactName: fields.contactName,
    contactPhone: fields.contactPhone ?? null,
    contactEmail: fields.contactEmail ?? null,
  });
  const client = await prisma.client.findUnique({
    where: { id: created.clientId },
    select: { id: true, name: true },
  });
  return { clientId: created.clientId, name: client?.name ?? fields.newClientName };
}

export async function quickCreateSupplierAction(fields: QuickFormFieldMap) {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate", session.activeCompanyCode)) {
    throw new Error("No tienes permiso para dar de alta un proveedor.");
  }
  const message = validateQuickSupplierDraft(fields);
  if (message) throw new Error(message);
  const created = await quickCreateSupplier(session, {
    name: fields.newSupplierName,
    contactName: fields.supplierContactName ?? null,
    phone: fields.supplierPhone ?? null,
    email: fields.supplierEmail ?? null,
  });
  const supplier = await prisma.supplier.findUnique({
    where: { id: created.supplierId },
    select: { id: true, name: true },
  });
  return { supplierId: created.supplierId, name: supplier?.name ?? fields.newSupplierName };
}

export async function quickCreateEquipmentAction(clientId: string, fields: QuickFormFieldMap) {
  const session = await requireCompany();
  if (!clientId) throw new Error("Primero elige o registra el cliente.");
  const message = validateQuickEquipmentDraft(fields);
  if (message) throw new Error(message);
  const kind = fields.equipmentKind === "MOT" ? "MOT" : "EQUI";
  const catalog = catalogFromFields(fields);
  const equipment = kind === "MOT"
    ? await (async () => {
      if (!can(session.role, "mot.create", session.activeCompanyCode)) {
        throw new Error("No tienes permiso para dar de alta un MOT.");
      }
      return createMotIdentity(session, { clientId, ...catalog, description: null });
    })()
    : await (async () => {
      if (!can(session.role, "equi.create", session.activeCompanyCode)) {
        throw new Error("No tienes permiso para dar de alta un EQUI.");
      }
      return createEqui(session, { clientId, ...catalog, description: null });
    })();
  return {
    equipmentId: equipment.id,
    folio: equipment.folio,
    model: equipment.model,
    kind: equipment.kind,
    clientId: equipment.clientId,
  };
}
