"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { QUOTE_TYPES, type QuoteType, applyDiscount, createSellerQuote, decideQuote, linkIntercompanyQuote, prepareQuoteFromCase, relateQuoteEquipment, setPrices } from "@/lib/quotes";
import { sendMail } from "@/lib/sendgrid";
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
    const quote = await createSellerQuote(session, {
      clientId,
      quoteType: quoteType as QuoteType,
      equipmentId: optionalText(formData.get("equipmentId")),
      preliminaryType: optionalText(formData.get("preliminaryType")),
      preliminaryBrand: optionalText(formData.get("preliminaryBrand")),
      preliminaryModel: optionalText(formData.get("preliminaryModel")),
      preliminarySerial: optionalText(formData.get("preliminarySerial")),
      reference: optionalText(formData.get("reference")),
      concepts,
      contactIds,
    });
    await setFlash({ tone: "ok", message: `${quote.folio} quedó registrada, sin precio.` });
    redirect(`/cotizaciones/${quote.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/cotizaciones/nuevo");
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
      requiredText(formData.get("priorityId"), "Prioridad"),
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

export async function sendQuoteMailAction(formData: FormData) {
  "use server";
  const target = back(formData);
  try {
    const session = await guard("quote.follow");
    const quote = await prisma.quote.findFirst({ where: { id: requiredText(formData.get("quoteId"), "Cotización"), companyId: session.activeCompanyId }, include: { client: { include: { contacts: { where: { active: true } } } }, company: true } });
    if (!quote) throw new Error("Esa cotización no es de esta empresa.");
    const email = quote.client.contacts.find((contact) => contact.email)?.email;
    if (!email) throw new Error("El cliente no tiene un contacto con correo. SendGrid no envió nada.");
    const result = await sendMail({ to: email, subject: `${quote.folio} · ${quote.company.name}`, text: `Cotización ${quote.folio} de ${quote.company.name}.` });
    if (!result.ok) throw new Error(result.message);
    await setFlash({ tone: "ok", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(target);
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
