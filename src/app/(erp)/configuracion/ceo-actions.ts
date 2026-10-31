"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { optionalInt, optionalText, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import {
  isCommercialGoalMetric,
  parseClabe,
  parseYearMonth,
} from "@/lib/ceo-config";
import { moneyFromForm } from "@/lib/money";
import { requireCompany } from "@/lib/session";

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error
    && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function requireCeo(back: string) {
  const session = await requireCompany();
  if (session.role !== "CEO") {
    await setFlash({ tone: "error", message: "Solo el CEO configura esta sección." });
    redirect(back.startsWith("/configuracion") ? "/inicio" : back);
  }
  return session;
}

async function fail(back: string, error: unknown): Promise<never> {
  if (isRedirect(error)) throw error;
  const message = isUnique(error)
    ? "Ya existe un registro con ese nombre."
    : error instanceof Error
      ? error.message
      : "No se pudo guardar.";
  await setFlash({ tone: "error", message });
  redirect(back);
}

function activeFromForm(formData: FormData) {
  return formData.get("active") !== "no";
}

function requiredNonNegative(formData: FormData, field: string, label: string) {
  const amount = moneyFromForm(formData.get(field), label);
  if (amount < 0) throw new Error(`${label} no puede ser negativo.`);
  return amount;
}

function requiredSla(formData: FormData) {
  const slaMaxDays = optionalInt(formData.get("slaMaxDays"));
  if (slaMaxDays == null || slaMaxDays < 1) throw new Error("El SLA máximo debe ser de al menos un día.");
  return slaMaxDays;
}

function requiredPercent(formData: FormData) {
  const text = optionalText(formData.get("incrementPct"));
  if (!text) throw new Error("El incremento porcentual es obligatorio.");
  const n = Number(text.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("El incremento porcentual no es válido.");
  return n;
}

export async function createFinanceAccountAction(formData: FormData) {
  "use server";
  const back = "/configuracion/cuentas";
  try {
    const session = await requireCeo(back);
    const fiscal = formData.get("fiscal") === "si";
    const kind = formData.get("kind") === "EFECTIVO" ? "EFECTIVO" : "BANCO";
    if (kind === "BANCO") {
      const bankName = requiredText(formData.get("bankName"), "Nombre del banco");
      const clabe = parseClabe(requiredText(formData.get("clabe"), "CLABE"));
      await prisma.financeAccount.create({
        data: {
          companyId: session.activeCompanyId,
          name: bankName,
          kind: "BANCO",
          bankName,
          clabe,
          fiscal,
          balance: 0,
        },
      });
    } else {
      const name = requiredText(formData.get("name"), "Nombre");
      await prisma.financeAccount.create({
        data: {
          companyId: session.activeCompanyId,
          name,
          kind: "EFECTIVO",
          bankName: null,
          clabe: null,
          fiscal,
          balance: 0,
        },
      });
    }
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "CUENTA",
      entityId: session.activeCompanyId,
      action: "ALTA",
      summary: "Nueva cuenta financiera desde Configuración del CEO.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Cuenta registrada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function updateFinanceAccountAction(formData: FormData) {
  "use server";
  const back = "/configuracion/cuentas";
  try {
    const session = await requireCeo(back);
    const id = requiredText(formData.get("accountId"), "Cuenta");
    const account = await prisma.financeAccount.findFirst({ where: { id, companyId: session.activeCompanyId } });
    if (!account) throw new Error("Esa cuenta no es de esta empresa.");
    const fiscal = formData.get("fiscal") === "si";
    if (account.kind === "BANCO") {
      const bankName = requiredText(formData.get("bankName"), "Nombre del banco");
      const clabe = parseClabe(requiredText(formData.get("clabe"), "CLABE"));
      await prisma.financeAccount.update({ where: { id: account.id }, data: { bankName, clabe, fiscal } });
    } else {
      await prisma.financeAccount.update({ where: { id: account.id }, data: { fiscal } });
    }
    await setFlash({ tone: "ok", message: "Cuenta actualizada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function saveIncomeCategoryAction(formData: FormData) {
  "use server";
  const back = "/configuracion/catalogos-financieros";
  try {
    const session = await requireCeo(back);
    const name = requiredText(formData.get("name"), "Nombre");
    const active = activeFromForm(formData);
    const id = optionalText(formData.get("id"));
    if (id) {
      const updated = await prisma.incomeCategory.updateMany({
        where: { id, companyId: session.activeCompanyId },
        data: { name, active },
      });
      if (updated.count === 0) throw new Error("Esa categoría de ingreso no es de esta empresa.");
    } else {
      await prisma.incomeCategory.create({ data: { companyId: session.activeCompanyId, name, active } });
    }
    await setFlash({ tone: "ok", message: "Categoría de ingreso guardada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function saveExpenseCategoryAction(formData: FormData) {
  "use server";
  const back = "/configuracion/catalogos-financieros";
  try {
    const session = await requireCeo(back);
    const name = requiredText(formData.get("name"), "Nombre");
    const active = activeFromForm(formData);
    const id = optionalText(formData.get("id"));
    if (id) {
      const updated = await prisma.expenseCategory.updateMany({
        where: { id, companyId: session.activeCompanyId },
        data: { name, active },
      });
      if (updated.count === 0) throw new Error("Esa categoría de egreso no es de esta empresa.");
    } else {
      await prisma.expenseCategory.create({ data: { companyId: session.activeCompanyId, name, active } });
    }
    await setFlash({ tone: "ok", message: "Categoría de egreso guardada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function saveExpenseSubcategoryAction(formData: FormData) {
  "use server";
  const back = "/configuracion/catalogos-financieros";
  try {
    const session = await requireCeo(back);
    const name = requiredText(formData.get("name"), "Nombre");
    const active = activeFromForm(formData);
    const categoryId = requiredText(formData.get("categoryId"), "Categoría de egreso");
    const category = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, companyId: session.activeCompanyId },
    });
    if (!category) throw new Error("Esa categoría de egreso no es de esta empresa.");
    const id = optionalText(formData.get("id"));
    if (id) {
      const current = await prisma.expenseSubcategory.findFirst({ where: { id, category: { companyId: session.activeCompanyId } } });
      if (!current) throw new Error("Esa subcategoría no es de esta empresa.");
      await prisma.expenseSubcategory.update({ where: { id }, data: { name, active, categoryId } });
    } else {
      await prisma.expenseSubcategory.create({ data: { categoryId, name, active } });
    }
    await setFlash({ tone: "ok", message: "Subcategoría de egreso guardada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function saveActivityTypeAction(formData: FormData) {
  "use server";
  const back = "/configuracion/actividades";
  try {
    const session = await requireCeo(back);
    const name = requiredText(formData.get("name"), "Nombre");
    const active = activeFromForm(formData);
    const id = optionalText(formData.get("id"));
    if (id) {
      const updated = await prisma.agendaCategory.updateMany({
        where: { id, companyId: session.activeCompanyId },
        data: { name, active },
      });
      if (updated.count === 0) throw new Error("Esa actividad no es de esta empresa.");
    } else {
      await prisma.agendaCategory.create({
        data: { companyId: session.activeCompanyId, name, active, countsForGoals: false },
      });
    }
    await setFlash({ tone: "ok", message: "Actividad comercial guardada." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function saveCommercialGoalsAction(formData: FormData) {
  "use server";
  const requested = optionalText(formData.get("month"));
  const back = requested ? `/configuracion/metas?mes=${requested}` : "/configuracion/metas";
  try {
    const session = await requireCeo("/configuracion/metas");
    const period = parseYearMonth(requested);
    if (!period) throw new Error("Selecciona un mes válido.");
    const metrics = [
      { id: "FACTURACION", label: "Facturación" },
      { id: "COBRANZA", label: "Cobranza / Pagos" },
    ] as const;
    for (const metric of metrics) {
      if (!isCommercialGoalMetric(metric.id)) continue;
      const amount = requiredNonNegative(formData, metric.id, metric.label);
      await prisma.commercialMonthlyGoal.upsert({
        where: {
          companyId_metric_year_month: {
            companyId: session.activeCompanyId,
            metric: metric.id,
            year: period.year,
            month: period.month,
          },
        },
        update: { amount },
        create: {
          companyId: session.activeCompanyId,
          metric: metric.id,
          year: period.year,
          month: period.month,
          amount,
        },
      });
    }
    await setFlash({ tone: "ok", message: "Metas del mes guardadas." });
    redirect(`/configuracion/metas?mes=${period.year}-${String(period.month).padStart(2, "0")}`);
  } catch (error) {
    await fail(back, error);
  }
}

export async function saveDiagnosisPriorityAction(formData: FormData) {
  "use server";
  await savePriority(formData, "DIAGNOSTICO", "/configuracion/prioridades/diagnostico");
}

export async function saveRepairPriorityAction(formData: FormData) {
  "use server";
  await savePriority(formData, "REPARACION", "/configuracion/prioridades/reparacion");
}

async function savePriority(formData: FormData, attentionType: "DIAGNOSTICO" | "REPARACION", back: string) {
  try {
    const session = await requireCeo(back);
    const name = requiredText(formData.get("name"), "Nombre");
    const active = activeFromForm(formData);
    const slaMaxDays = requiredSla(formData);
    const id = optionalText(formData.get("priorityId"));
    const data = attentionType === "DIAGNOSTICO"
      ? { name, active, slaMaxDays, price: requiredNonNegative(formData, "price", "Costo fijo") }
      : { name, active, slaMaxDays, incrementPct: requiredPercent(formData) };
    if (id) {
      const updated = await prisma.priority.updateMany({
        where: { id, companyId: session.activeCompanyId, attentionType },
        data,
      });
      if (updated.count === 0) throw new Error("Esa prioridad no es de este grupo en la empresa.");
    } else {
      const last = await prisma.priority.aggregate({
        where: { companyId: session.activeCompanyId, attentionType },
        _max: { sortOrder: true },
      });
      await prisma.priority.create({
        data: {
          companyId: session.activeCompanyId,
          attentionType,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          targetMinDays: null,
          targetMaxDays: null,
          price: attentionType === "DIAGNOSTICO" ? requiredNonNegative(formData, "price", "Costo fijo") : null,
          incrementPct: attentionType === "REPARACION" ? requiredPercent(formData) : null,
          name,
          active,
          slaMaxDays,
        },
      });
    }
    await setFlash({ tone: "ok", message: "Prioridad guardada. Las atenciones ya abiertas conservan su fotografía." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}

export async function savePurchaseBudgetsAction(formData: FormData) {
  "use server";
  const back = "/configuracion/presupuestos";
  try {
    const session = await requireCeo(back);
    const partsMonthlyBudget = requiredNonNegative(formData, "parts", "Refacciones");
    const generalMonthlyBudget = requiredNonNegative(formData, "general", "Generales");
    await prisma.company.update({
      where: { id: session.activeCompanyId },
      data: { partsMonthlyBudget, generalMonthlyBudget },
    });
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "EMPRESA",
      entityId: session.activeCompanyId,
      action: "PRESUPUESTO",
      summary: `Presupuesto mensual de compras: refacciones ${partsMonthlyBudget} y generales ${generalMonthlyBudget}. No limita una compra individual.`,
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Presupuestos mensuales de compra guardados." });
  } catch (error) {
    await fail(back, error);
  }
  redirect(back);
}
