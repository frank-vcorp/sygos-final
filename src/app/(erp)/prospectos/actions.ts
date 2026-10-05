import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const OPEN = ["NUEVO", "EN_SEGUIMIENTO"];

async function guard() {
  const session = await requireCompany();
  if (!can(session.role, "prospect.operate", session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para prospectos." });
    redirect("/inicio");
  }
  return session;
}

async function assertOwnProspect(session: Awaited<ReturnType<typeof guard>>, id: string) {
  if (session.role !== "VENTAS") return;
  const own = await prisma.prospect.findFirst({ where: { id, companyId: session.activeCompanyId, ownerUserId: session.userId } });
  if (!own) {
    await setFlash({ tone: "error", message: "Ese prospecto no está en tu cartera." });
    redirect("/prospectos");
  }
}

export async function createProspectAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const ownerUserId =
      session.role === "COORDINACION_ADMINISTRACION" || session.role === "ADMINISTRADOR"
        ? (await prisma.user.findFirst({ where: { role: "CEO", active: true }, orderBy: { username: "asc" } }))?.id ?? session.userId
        : session.userId;
    const prospect = await prisma.prospect.create({
      data: {
        companyId: session.activeCompanyId,
        name: requiredText(formData.get("name"), "Empresa o nombre"),
        source: optionalText(formData.get("source")),
        note: optionalText(formData.get("note")),
        ownerUserId,
        status: "NUEVO",
      },
    });
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROSPECTO",
      entityId: prospect.id,
      action: "ALTA",
      summary: "Prospecto creado en estado Nuevo.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Prospecto creado." });
    redirect(`/prospectos/${prospect.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/prospectos/nuevo");
  }
}

export async function updateProspectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Prospecto");
  try {
    const session = await guard();
    await assertOwnProspect(session, id);
    const current = await prisma.prospect.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!current || !OPEN.includes(current.status)) {
      throw new Error("Este prospecto ya no se edita.");
    }
    const updated = await prisma.prospect.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), status: { in: OPEN } },
      data: {
        name: requiredText(formData.get("name"), "Empresa o nombre"),
        source: optionalText(formData.get("source")),
        note: optionalText(formData.get("note")),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await setFlash({ tone: "ok", message: "Prospecto actualizado." });
    redirect(`/prospectos/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/prospectos/${id}`);
  }
}

export async function addProspectActivityAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Prospecto");
  try {
    const session = await guard();
    await assertOwnProspect(session, id);
    const note = requiredText(formData.get("note"), "Nota");
    const follow = optionalText(formData.get("nextFollowUp"));
    const nextFollowUp = follow ? new Date(`${follow}T12:00:00`) : null;
    if (follow && Number.isNaN(nextFollowUp?.getTime())) throw new Error("La fecha de seguimiento no es válida.");
    const current = await prisma.prospect.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!current || !OPEN.includes(current.status)) throw new Error("Este prospecto no admite seguimiento.");
    await prisma.prospectActivity.create({
      data: { prospectId: id, note, nextFollowUp, authorUserId: session.userId },
    });
    if (current.status === "NUEVO") {
      await prisma.prospect.update({ where: { id }, data: { status: "EN_SEGUIMIENTO", version: { increment: 1 } } });
    }
    await setFlash({ tone: "ok", message: "Seguimiento registrado. No se envían recordatorios automáticos." });
    redirect(`/prospectos/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/prospectos/${id}`);
  }
}

export async function convertProspectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Prospecto");
  try {
    const session = await guard();
    await assertOwnProspect(session, id);
    const prospect = await prisma.prospect.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!prospect || !OPEN.includes(prospect.status) || prospect.clientId) {
      throw new Error("Este prospecto no se puede convertir.");
    }
    const mode = requiredText(formData.get("mode"), "Modo de conversión");
    let clientId: string;
    if (mode === "existente") {
      clientId = requiredText(formData.get("clientId"), "Cliente");
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: session.activeCompanyId, active: true, isSystem: false },
      });
      if (!client) throw new Error("El cliente no pertenece a la empresa activa.");
    } else if (mode === "nuevo") {
      const contactName = requiredText(formData.get("contactName"), "Nombre del contacto");
      const client = await prisma.client.create({
        data: {
          companyId: session.activeCompanyId,
          name: prospect.name,
          ownerUserId: prospect.ownerUserId,
          contacts: { create: { name: contactName, isPrimary: true } },
        },
      });
      clientId = client.id;
      await recordHistory({
        companyId: session.activeCompanyId,
        entityType: "CLIENTE",
        entityId: client.id,
        action: "ALTA",
        summary: "Cliente creado desde prospecto. El responsable comercial se conserva.",
        authorUserId: session.userId,
      });
    } else {
      throw new Error("Elige crear un cliente o usar uno existente.");
    }
    const updated = await prisma.prospect.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), clientId: null, status: { in: OPEN } },
      data: { status: "CONVERTIDO", clientId, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROSPECTO",
      entityId: id,
      action: "CONVERSION",
      summary: "Convertido a cliente. El prospecto se conserva como antecedente.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Prospecto convertido." });
    redirect(`/prospectos/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/prospectos/${id}`);
  }
}

export async function discardProspectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Prospecto");
  try {
    const session = await guard();
    await assertOwnProspect(session, id);
    const updated = await prisma.prospect.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), status: { in: OPEN } },
      data: { status: "DESCARTADO", version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROSPECTO",
      entityId: id,
      action: "DESCARTE",
      summary: optionalText(formData.get("reason")) ?? "Prospecto descartado.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Prospecto descartado." });
    redirect(`/prospectos/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/prospectos/${id}`);
  }
}

export async function reactivateProspectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Prospecto");
  try {
    const session = await guard();
    if (session.role !== "CEO" && session.role !== "ADMINISTRADOR") {
      throw new Error("Solo CEO o Administrador pueden reactivar un prospecto.");
    }
    const updated = await prisma.prospect.updateMany({
      where: { id, companyId: session.activeCompanyId, version: parseVersion(formData.get("version")), status: "DESCARTADO" },
      data: { status: "EN_SEGUIMIENTO", version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "PROSPECTO",
      entityId: id,
      action: "REACTIVACION",
      summary: "Reactivación explícita a En seguimiento.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Prospecto reactivado." });
    redirect(`/prospectos/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/prospectos/${id}`);
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
