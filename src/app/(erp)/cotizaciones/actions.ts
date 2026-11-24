"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { moneyFromForm } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import { parsePaymentCondition, parseQuoteCreditDays, parseWarrantyMonths } from "@/lib/quote-commercial-terms";
import { parseDeliveryBusinessDays, parseFieldServiceMachineFromForm, parseSellerSaleLines } from "@/lib/quote-seller-input";
import { QUOTE_TYPES, type QuoteType, applyDiscount, createSellerQuote, decideQuote, linkIntercompanyQuote, prepareQuoteFromCase, relateQuoteEquipment, setPrices, updateGeneratedQuoteConcepts, updateQuoteLineDescriptions, updateQuoteLinePrices, updateSellerQuoteConceptComplement } from "@/lib/quotes";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para esta acción." });
    redirect("/cotizaciones");
  }
  return session;
}

function back(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  return id ? `/cotizaciones/${id}` : "/cotizaciones";
}

export async function createQuoteAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("quote.create");
    const quoteType = requiredText(formData.get("quoteType"), "Tipo");
    if (!(QUOTE_TYPES as readonly string[]).includes(quoteType)) throw new Error("El tipo de cotización no existe.");
    const concepts = String(formData.get("concepts") ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [concept, rawQty] = line.split("|").map((part) => part.trim());
        const quantity = rawQty ? Number(rawQty) : 1;
        if (!concept || !Number.isInteger(quantity) || quantity < 1) throw new Error("Cada concepto usa el formato descripción|cantidad.");
        return { concept, quantity };
      });
    const resolvedClient = await clientIdFromForm(session, formData);
    const clientId = resolvedClient.clientId;
    let contactIds = formData.getAll("contactId").map(String).filter(Boolean);
    if (resolvedClient.primaryContactId && contactIds.length === 0) {
      contactIds = [resolvedClient.primaryContactId];
    }
    const paymentCondition = parsePaymentCondition(formData.get("paymentCondition"));
    const quote = await createSellerQuote(session, {
      clientId,
      quoteType: quoteType as QuoteType,
      equipmentId: optionalText(formData.get("equipmentId")),
      reference: optionalText(formData.get("reference")),
      concepts,
      contactIds,
      priorityId: optionalText(formData.get("priorityId")),
      warrantyMonths: parseWarrantyMonths(formData.get("warrantyMonths")),
      paymentCondition,
      creditDays: parseQuoteCreditDays(paymentCondition, formData.get("creditDays")),
      ...(quoteType === "VENTA_EQUIPO"
        ? {
            sellerSaleLines: parseSellerSaleLines(formData),
            deliveryBusinessDays: parseDeliveryBusinessDays(formData.get("deliveryBusinessDays")),
          }
        : {}),
      ...(quoteType === "CAMPO" ? { fieldServiceMachine: parseFieldServiceMachineFromForm(formData) } : {}),
    });
    const fromVentas = optionalText(formData.get("origin")) === "ventas";
    const diagnosisAutoPriced = quote.quoteType === "DIAGNOSTICO" && quote.status === "PENDIENTE_DECISION";
    const ventaReady = quote.quoteType === "VENTA_EQUIPO" && quote.status === "PENDIENTE_DECISION";
    await setFlash({
      tone: "ok",
      message: ventaReady
        ? `${quote.folio} quedó lista para decisión del cliente (precio y T.E. capturados).`
        : fromVentas
          ? `${quote.folio} registrada como venta de equipo.`
          : diagnosisAutoPriced
            ? `${quote.folio} quedó registrada con precio del catálogo de diagnóstico; pendiente de decisión del cliente.`
            : quote.quoteType === "CAMPO"
              ? `${quote.folio} quedó registrada; gerencia asignará horas y tarifa.`
              : `${quote.folio} quedó registrada, sin precio.`,
    });
    redirect(`/cotizaciones/${quote.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(optionalText(formData.get("origin")) === "ventas" ? "/ventas/nuevo" : "/cotizaciones/nuevo");
  }
}

export async function relateEquipmentAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.follow");
    const quoteId = requiredText(formData.get("quoteId"), "Cotización");
    const equipmentId = requiredText(formData.get("equipmentId"), "Equipo");
    await relateQuoteEquipment(
      session,
      quoteId,
      parseVersion(formData.get("version")),
      equipmentId,
      optionalText(formData.get("priorityId")) ?? "",
    );
    await setFlash({ tone: "ok", message: "Equipo relacionado. La operación arranca cuando el equipo está en resguardo." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function prepareFromCaseAction(formData: FormData) {
  "use server";
  const caseId = requiredText(formData.get("caseId"), "Operación");
  try {
    const session = await guard("quote.price");
    const quote = await prepareQuoteFromCase(session, caseId);
    redirect(`/cotizaciones/${quote.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/operacion/${caseId}`);
  }
}

export async function updateQuoteLinePricesAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    const prices = formData.getAll("lineId").map((lineId, index) => ({
      lineId: String(lineId),
      amount: moneyFromForm(formData.getAll("amount")[index], "Precio"),
    }));
    await updateQuoteLinePrices(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      prices,
    );
    await setFlash({ tone: "ok", message: "Precios de partidas actualizados." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function updateQuoteLineDescriptionsAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    const lineIds = formData.getAll("lineId");
    const concepts = formData.getAll("concept");
    const descriptions = lineIds.map((lineId, index) => ({
      lineId: String(lineId),
      concept: requiredText(concepts[index], "Descripción"),
    }));
    await updateQuoteLineDescriptions(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      descriptions,
    );
    await setFlash({ tone: "ok", message: "Descripciones de partidas actualizadas." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function setPricesAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    const prices = formData.getAll("lineId").map((lineId, index) => ({
      lineId: String(lineId),
      amount: moneyFromForm(formData.getAll("amount")[index], "Precio"),
    }));
    const deliveryRaw = formData.get("deliveryBusinessDays");
    const deliveryBusinessDays = deliveryRaw != null && String(deliveryRaw).trim() !== ""
      ? Number.parseInt(String(deliveryRaw), 10)
      : null;
    const hoursRaw = formData.get("fieldServiceHours");
    const fieldServiceHours = hoursRaw != null && String(hoursRaw).trim() !== ""
      ? Number.parseFloat(String(hoursRaw))
      : null;
    const paymentCondition = parsePaymentCondition(formData.get("paymentCondition"));
    await setPrices(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      prices,
      deliveryBusinessDays,
      fieldServiceHours,
      {
        warrantyMonths: parseWarrantyMonths(formData.get("warrantyMonths")),
        paymentCondition,
        creditDays: parseQuoteCreditDays(paymentCondition, formData.get("creditDays")),
      },
    );
    await setFlash({ tone: "ok", message: "Precio asignado." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function updateGeneratedConceptAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    const concepts = formData.getAll("lineId").map((lineId, index) => ({
      lineId: String(lineId),
      concept: requiredText(formData.getAll("concept")[index], "Concepto"),
    }));
    await updateGeneratedQuoteConcepts(session, requiredText(formData.get("quoteId"), "Cotización"), parseVersion(formData.get("version")), concepts);
    await setFlash({ tone: "ok", message: "Concepto actualizado. Ya puedes asignar el precio." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function updateSellerConceptComplementAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.follow");
    await updateSellerQuoteConceptComplement(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      optionalText(formData.get("sellerConceptComplement")),
    );
    await setFlash({ tone: "ok", message: "Complemento del concepto actualizado." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function discountAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.follow");
    await applyDiscount(session, requiredText(formData.get("quoteId"), "Cotización"), parseVersion(formData.get("version")), Number(formData.get("discountPct")));
    await setFlash({ tone: "ok", message: "Descuento aplicado." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function decideAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.follow");
    const rawDiscount = optionalText(formData.get("discountPct"));
    const discountPct = rawDiscount != null && rawDiscount !== "" ? Number(rawDiscount) : null;
    await decideQuote(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      formData.get("decision") === "si",
      formData.getAll("authorizedLine").map(String),
      optionalText(formData.get("reason")),
      discountPct,
    );
    await setFlash({ tone: "ok", message: "Decisión registrada." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

export async function linkBaseAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    await linkIntercompanyQuote(session, requiredText(formData.get("baseQuoteId"), "Cotización base"), requiredText(formData.get("quoteId"), "Cotización"));
    await setFlash({ tone: "ok", message: "Cotización base de Servomotores ligada. El vendedor no la ve." });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(target);
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
