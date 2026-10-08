"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { applyCount, changeStock } from "@/lib/equipment-service";
import { setFlash } from "@/lib/flash";
import { optionalInt, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

async function guard() {
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para el inventario de esta empresa." });
    redirect("/inicio");
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company?.inventoryEnabled) {
    await setFlash({ tone: "error", message: "El inventario de esta empresa está deshabilitado." });
    redirect("/inventario");
  }
  return session;
}

export async function createPartAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const partNumber = requiredText(formData.get("partNumber"), "Nombre de producto");
    const description = optionalText(formData.get("description")) ?? "";
    const catalogNumero = optionalText(formData.get("catalogNumero")) ?? "";
    const family = optionalText(formData.get("family")) ?? "";
    const rack = optionalText(formData.get("rack")) ?? "";
    const nivel = optionalText(formData.get("nivel")) ?? "";
    const unit = optionalText(formData.get("unit")) ?? "";
    const mountType = optionalText(formData.get("mountType")) ?? "";
    const minQty = optionalInt(formData.get("minQty"));
    const maxQty = optionalInt(formData.get("maxQty"));
    if (minQty != null && maxQty != null && minQty > maxQty) throw new Error("El mínimo no puede ser mayor que el máximo.");
    const part = await prisma.part.create({
      data: {
        companyId: session.activeCompanyId,
        partNumber,
        description,
        catalogNumero,
        family,
        rack,
        nivel,
        unit,
        mountType,
        minQty,
        maxQty,
        qty: 0,
      },
    });
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "REFACCION",
      entityId: part.id,
      action: "ALTA",
      summary: `Refacción ${partNumber} dada de alta sin existencia.`,
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Refacción agregada. La existencia cambia con un movimiento." });
    redirect("/inventario");
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/inventario");
  }
}

export async function stockAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const kind = formData.get("kind") === "SALIDA" ? "SALIDA" : "ENTRADA";
    await changeStock(session, {
      partId: requiredText(formData.get("partId"), "Refacción"),
      version: parseVersion(formData.get("version")),
      kind,
      quantity: Number(formData.get("quantity")),
      note: optionalText(formData.get("note")),
    });
    await setFlash({ tone: "ok", message: kind === "ENTRADA" ? "Entrada registrada." : "Salida registrada." });
    redirect("/inventario");
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/inventario");
  }
}

export type CountPreview = {
  error?: string;
  rows: Array<{ partId: string; label: string; description: string; current: number; counted: number; delta: number }>;
  unknown: string[];
  conteoPayload: string;
};

export async function previewCountAction(_prev: CountPreview, formData: FormData): Promise<CountPreview> {
  "use server";
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode)) {
    return { error: "No tienes permiso para el inventario.", rows: [], unknown: [], conteoPayload: "" };
  }
  const parsed = parseCount(String(formData.get("conteo") ?? ""));
  if (parsed.error) return { error: parsed.error, rows: [], unknown: [], conteoPayload: "" };
  const parts = await prisma.part.findMany({ where: { companyId: session.activeCompanyId, active: true } });
  const byId = new Map(parts.map((part) => [part.id, part]));
  const unknown: string[] = [];
  const rows = [];
  for (const row of parsed.rows) {
    const part = byId.get(row.partId);
    if (!part) {
      unknown.push(row.partId);
      continue;
    }
    rows.push({
      partId: part.id,
      label: part.partNumber,
      description: part.description,
      current: part.qty,
      counted: row.counted,
      delta: row.counted - part.qty,
    });
  }
  const conteoPayload = parsed.rows.map((row) => `${row.partId},${row.counted}`).join("\n");
  return { rows, unknown, conteoPayload };
}

export async function applyCountAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const parsed = parseCount(String(formData.get("conteo") ?? ""));
    if (parsed.error) throw new Error(parsed.error);
    const applied = await applyCount(session, parsed.rows);
    await setFlash({ tone: "ok", message: applied === 0 ? "El conteo coincide con la existencia." : `Se ajustaron ${applied} refacciones.` });
    redirect("/inventario");
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/inventario/conteo");
  }
}

function parseCount(text: string): { rows: Array<{ partId: string; counted: number }>; error?: string } {
  const rows: Array<{ partId: string; counted: number }> = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("id") || trimmed.startsWith("numero")) continue;
    const [partId, raw] = trimmed.split(/[,;\t]/).map((part) => part.trim());
    if (!partId || raw == null || raw === "") return { rows: [], error: `La línea "${trimmed}" necesita id de línea y conteo.` };
    if (seen.has(partId)) return { rows: [], error: `El id ${partId} está repetido.` };
    const counted = Number(raw);
    if (!Number.isInteger(counted) || counted < 0) return { rows: [], error: `El conteo de ${partId} debe ser un entero positivo o cero.` };
    seen.add(partId);
    rows.push({ partId, counted });
  }
  if (rows.length === 0) return { rows: [], error: "Pega al menos una línea con id de línea (exportar inventario) y conteo." };
  return { rows };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
