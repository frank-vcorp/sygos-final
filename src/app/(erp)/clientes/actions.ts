import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalBool, optionalInt, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { parseRegimen } from "@/lib/sat-regimen";
import { requireCompany } from "@/lib/session";

async function guard(action: "client.create" | "client.edit" | "client.reassign" | "client.inactivate") {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para esta acción." });
    redirect("/clientes");
  }
  return session;
}

async function assertOwn(session: Awaited<ReturnType<typeof guard>>, clientId: string) {
  if (session.role !== "VENTAS") return;
  const own = await prisma.client.findFirst({ where: { id: clientId, companyId: session.activeCompanyId, ownerUserId: session.userId } });
  if (!own) {
    await setFlash({ tone: "error", message: "Ese cliente no está en tu cartera." });
    redirect("/clientes");
  }
}

async function ownerForCreator(session: Awaited<ReturnType<typeof guard>>) {
  if (session.role === "VENTAS" || session.role === "GERENTE_OPERATIVO_SERVOMOTORES" || session.role === "CEO") {
    return session.userId;
  }
  if (session.role === "COORDINACION_ADMINISTRACION" || session.role === "ADMINISTRADOR") {
    const ceo = await prisma.user.findFirst({
      where: { role: "CEO", active: true },
      orderBy: { username: "asc" },
    });
    return ceo?.id ?? null;
  }
  return null;
}

function clientData(formData: FormData) {
  const classification = optionalText(formData.get("classification"));
  if (classification && classification !== "NORMAL" && classification !== "PREMIUM") {
    throw new Error("La clasificación debe ser Normal o Premium.");
  }
  return {
    name: requiredText(formData.get("name"), "Nombre o razón social"),
    classification,
    requiresInvoice: optionalBool(formData.get("requiresInvoice")),
    creditDays: optionalInt(formData.get("creditDays")),
    rfc: optionalText(formData.get("rfc")),
    taxRegime: parseRegimen(formData.get("taxRegime")),
    fiscalZip: optionalText(formData.get("fiscalZip")),
    fiscalAddress: optionalText(formData.get("fiscalAddress")),
    deliveryAddress: optionalText(formData.get("deliveryAddress")),
  };
}

export async function createClientAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("client.create");
    const data = clientData(formData);
    const ownerUserId = await ownerForCreator(session);
    const client = await prisma.client.create({
      data: { ...data, companyId: session.activeCompanyId, ownerUserId },
    });
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "CLIENTE",
      entityId: client.id,
      action: "ALTA",
      summary: `Alta de cliente. Responsable inicial: ${ownerUserId ? "asignado" : "sin usuario CEO activo"}.`,
      authorUserId: session.userId,
    });
    redirect(`/clientes/${client.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/clientes/nuevo");
  }
}

export async function updateClientAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Cliente");
  try {
    const session = await guard("client.edit");
    await assertOwn(session, id);
    const version = parseVersion(formData.get("version"));
    const current = await prisma.client.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!current || current.isSystem) {
      await setFlash({ tone: "error", message: "El cliente no está disponible en la empresa activa." });
      redirect("/clientes");
    }
    const data = clientData(formData);
    const updated = await prisma.client.updateMany({
      where: { id, companyId: session.activeCompanyId, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    if (current.requiresInvoice !== data.requiresInvoice) {
      await recordHistory({
        companyId: session.activeCompanyId,
        entityType: "CLIENTE",
        entityId: id,
        action: "REQUIERE_FACTURA",
        summary: `Requiere factura: ${labelBool(data.requiresInvoice)}.`,
        authorUserId: session.userId,
      });
    }
    await setFlash({ tone: "ok", message: "Cliente actualizado." });
    redirect(`/clientes/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/clientes/${id}`);
  }
}

export async function reassignClientAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Cliente");
  try {
    const session = await guard("client.reassign");
    const version = parseVersion(formData.get("version"));
    const ownerUserId = requiredText(formData.get("ownerUserId"), "Responsable");
    const owner = await prisma.user.findFirst({ where: { id: ownerUserId, active: true } });
    if (!owner || (owner.role !== "VENTAS" && owner.role !== "CEO" && owner.role !== "GERENTE_OPERATIVO_SERVOMOTORES")) {
      throw new Error("El responsable debe ser un usuario comercial activo.");
    }
    if (session.activeCompanyCode === "SYSTRON" && owner.role === "GERENTE_OPERATIVO_SERVOMOTORES") {
      throw new Error("Ese responsable no opera en SYSTRON.");
    }
    if (session.activeCompanyCode === "SERVOMOTORES" && owner.role === "VENTAS") {
      throw new Error("Ese responsable no opera en Servomotores.");
    }
    const updated = await prisma.client.updateMany({
      where: { id, companyId: session.activeCompanyId, version, isSystem: false },
      data: { ownerUserId, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "CLIENTE",
      entityId: id,
      action: "REASIGNACION",
      summary: `Responsable comercial: ${owner.name}.`,
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Responsable actualizado." });
    redirect(`/clientes/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/clientes/${id}`);
  }
}

export async function inactivateClientAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Cliente");
  try {
    const session = await guard("client.inactivate");
    const version = parseVersion(formData.get("version"));
    const updated = await prisma.client.updateMany({
      where: { id, companyId: session.activeCompanyId, version, isSystem: false, active: true },
      data: { active: false, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "CLIENTE",
      entityId: id,
      action: "INACTIVACION",
      summary: "Cliente inactivado. El historial se conserva.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Cliente inactivado." });
    redirect(`/clientes/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/clientes/${id}`);
  }
}

export async function addContactAction(formData: FormData) {
  "use server";
  const clientId = requiredText(formData.get("clientId"), "Cliente");
  try {
    const session = await guard("client.edit");
    await assertOwn(session, clientId);
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.activeCompanyId, isSystem: false } });
    if (!client) redirect("/clientes");
    const name = requiredText(formData.get("name"), "Nombre del contacto");
    const makePrimary = formData.get("isPrimary") === "si";
    const existing = await prisma.contact.count({ where: { clientId, active: true } });
    const isPrimary = makePrimary || existing === 0;
    if (isPrimary) {
      await prisma.contact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    }
    await prisma.contact.create({
      data: {
        clientId,
        name,
        phone: optionalText(formData.get("phone")),
        roleTitle: optionalText(formData.get("roleTitle")),
        email: optionalText(formData.get("email")),
        isPrimary,
      },
    });
    await setFlash({ tone: "ok", message: "Contacto agregado." });
    redirect(`/clientes/${clientId}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/clientes/${clientId}`);
  }
}

export async function inactivateContactAction(formData: FormData) {
  "use server";
  const session = await guard("client.edit");
  const contactId = requiredText(formData.get("contactId"), "Contacto");
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, client: { companyId: session.activeCompanyId } },
  });
  if (!contact) redirect("/clientes");
  await assertOwn(session, contact.clientId);
  await prisma.contact.update({ where: { id: contact.id }, data: { active: false, isPrimary: false } });
  await setFlash({ tone: "ok", message: "Contacto inactivado." });
  redirect(`/clientes/${contact.clientId}`);
}

function labelBool(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "sin definir";
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
