"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { QUOTE_TYPES, type QuoteType, applyDiscount, createSellerQuote, decideQuote, linkIntercompanyQuote, prepareQuoteFromCase, setPrices } from "@/lib/quotes";
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
    const quote = await createSellerQuote(session, {
      clientId: requiredText(formData.get("clientId"), "Cliente"),
      quoteType: quoteType as QuoteType,
      equipmentId: optionalText(formData.get("equipmentId")),
      preliminaryType: optionalText(formData.get("preliminaryType")),
      preliminaryBrand: optionalText(formData.get("preliminaryBrand")),
      preliminaryModel: optionalText(formData.get("preliminaryModel")),
      preliminarySerial: optionalText(formData.get("preliminarySerial")),
      reference: optionalText(formData.get("reference")),
      concepts,
      contactIds: formData.getAll("contactId").map(String).filter(Boolean),
    });
    redirect(`/cotizaciones/${quote.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/cotizaciones/nuevo");
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

export async function setPricesAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.price");
    const prices = formData.getAll("lineId").map((lineId, index) => ({
      lineId: String(lineId),
      amount: Number(formData.getAll("amount")[index]),
    }));
    await setPrices(session, requiredText(formData.get("quoteId"), "Cotización"), parseVersion(formData.get("version")), prices);
    await setFlash({ tone: "ok", message: "Precio asignado." });
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
    await decideQuote(
      session,
      requiredText(formData.get("quoteId"), "Cotización"),
      parseVersion(formData.get("version")),
      formData.get("decision") === "si",
      formData.getAll("authorizedLine").map(String),
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
