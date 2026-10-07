import { resolveClientIdForProcess } from "@/lib/client-quick-create";
import { optionalText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import type { AppSession } from "@/lib/session";
import { resolveSupplierIdForProcess } from "@/lib/supplier-quick-create";

type Session = Pick<AppSession, "userId" | "role" | "activeCompanyCode"> & { activeCompanyId: string };

function quickClientFields(formData: FormData) {
  return {
    newClientName: optionalText(formData.get("newClientName")),
    contactName: optionalText(formData.get("contactName")),
    contactPhone: optionalText(formData.get("contactPhone")),
    contactEmail: optionalText(formData.get("contactEmail")),
  };
}

function quickSupplierFields(formData: FormData) {
  return {
    newSupplierName: optionalText(formData.get("newSupplierName")),
    contactName: optionalText(formData.get("supplierContactName")),
    phone: optionalText(formData.get("supplierPhone")),
    email: optionalText(formData.get("supplierEmail")),
  };
}

export async function clientIdFromForm(session: Session, formData: FormData) {
  const clientId = optionalText(formData.get("clientId"));
  if (clientId) return { clientId, primaryContactId: null as string | null };
  if (!can(session.role as AppSession["role"], "client.create" as Action, session.activeCompanyCode)) {
    throw new Error("Selecciona un cliente.");
  }
  return resolveClientIdForProcess(session, { clientId: null, ...quickClientFields(formData) });
}

export async function supplierIdFromForm(
  session: Session,
  formData: FormData,
  options: { required?: boolean } = {},
) {
  const supplierId = optionalText(formData.get("supplierId"));
  if (supplierId) return supplierId;
  const quick = quickSupplierFields(formData);
  if (!quick.newSupplierName?.trim()) {
    if (options.required) throw new Error("Elige un proveedor o completa el alta rápida.");
    return null;
  }
  if (!can(session.role as AppSession["role"], "supplier.operate" as Action, session.activeCompanyCode)) {
    throw new Error("No tienes permiso para dar de alta un proveedor.");
  }
  const resolved = await resolveSupplierIdForProcess(session, { supplierId: null, ...quick });
  return resolved.supplierId;
}
