import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalBool, optionalInt, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

async function guard() {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate", session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para proveedores." });
    redirect("/inicio");
  }
  return session;
}

function supplierData(formData: FormData) {
  return {
    name: requiredText(formData.get("name"), "Nombre o razón social"),
    contactName: optionalText(formData.get("contactName")),
    phone: optionalText(formData.get("phone")),
    email: optionalText(formData.get("email")),
    rfc: optionalText(formData.get("rfc")),
    fiscalAddress: optionalText(formData.get("fiscalAddress")),
    creditDays: optionalInt(formData.get("creditDays")),
    issuesInvoice: optionalBool(formData.get("issuesInvoice")),
    category: optionalText(formData.get("category")),
  };
}

export async function createSupplierAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const supplier = await prisma.supplier.create({
      data: { ...supplierData(formData), companyId: session.activeCompanyId },
    });
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROVEEDOR",
      entityId: supplier.id,
      action: "ALTA",
      summary: "Proveedor creado.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Proveedor creado." });
    redirect(`/proveedores/${supplier.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/proveedores/nuevo");
  }
}

export async function updateSupplierAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Proveedor");
  try {
    const session = await guard();
    const current = await prisma.supplier.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!current || current.isSystem) throw new Error("Este proveedor no se edita.");
    const updated = await prisma.supplier.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), isSystem: false },
      data: { ...supplierData(formData), version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await setFlash({ tone: "ok", message: "Proveedor actualizado." });
    redirect(`/proveedores/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/proveedores/${id}`);
  }
}

export async function setSupplierActiveAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Proveedor");
  try {
    const session = await guard();
    const active = formData.get("active") === "si";
    const updated = await prisma.supplier.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), isSystem: false },
      data: { active, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROVEEDOR",
      entityId: id,
      action: active ? "REACTIVACION" : "INACTIVACION",
      summary: active ? "Proveedor reactivado." : "Proveedor inactivado. El historial se conserva.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: active ? "Proveedor reactivado." : "Proveedor inactivado." });
    redirect(`/proveedores/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/proveedores/${id}`);
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
