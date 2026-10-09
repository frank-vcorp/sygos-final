import { prisma } from "@/lib/db";
import { recordHistory } from "@/lib/history";

type QuickClientActor = {
  userId: string;
  role: string;
  activeCompanyId: string;
};

async function ownerForQuickClient(actor: QuickClientActor) {
  if (actor.role === "VENTAS" || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" || actor.role === "CEO") {
    return actor.userId;
  }
  if (actor.role === "COORDINACION_ADMINISTRACION" || actor.role === "ADMINISTRADOR") {
    const ceo = await prisma.user.findFirst({
      where: { role: "CEO", active: true },
      orderBy: { username: "asc" },
    });
    return ceo?.id ?? null;
  }
  return null;
}

export async function quickCreateClient(
  actor: QuickClientActor,
  input: {
    name: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string | null;
  },
) {
  const ownerUserId = await ownerForQuickClient(actor);
  const phone = input.contactPhone.trim();
  if (!phone) throw new Error("El teléfono del contacto es obligatorio.");
  const client = await prisma.client.create({
    data: {
      companyId: actor.activeCompanyId,
      name: input.name.trim(),
      ownerUserId,
      contacts: {
        create: {
          name: input.contactName.trim(),
          phone,
          email: input.contactEmail?.trim() || null,
          isPrimary: true,
        },
      },
    },
    include: { contacts: { where: { active: true } } },
  });
  const primary = client.contacts.find((row) => row.isPrimary) ?? client.contacts[0];
  if (!primary) throw new Error("No se pudo crear el contacto del cliente.");
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "CLIENTE",
    entityId: client.id,
    action: "ALTA",
    summary: "Alta rápida de cliente desde un proceso operativo.",
    authorUserId: actor.userId,
  });
  return { clientId: client.id, primaryContactId: primary.id };
}

export async function resolveClientIdForProcess(
  actor: QuickClientActor,
  input: {
    clientId: string | null;
    newClientName: string | null;
    contactName: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  },
) {
  if (input.clientId) return { clientId: input.clientId, primaryContactId: null as string | null };
  if (!input.newClientName?.trim() || !input.contactName?.trim() || !input.contactPhone?.trim()) {
    throw new Error("Elige un cliente o abre el alta rápida e indica su nombre, el contacto y el teléfono.");
  }
  const created = await quickCreateClient(actor, {
    name: input.newClientName,
    contactName: input.contactName,
    contactPhone: input.contactPhone!,
    contactEmail: input.contactEmail,
  });
  return { clientId: created.clientId, primaryContactId: created.primaryContactId };
}
