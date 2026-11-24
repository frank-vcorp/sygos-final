export type {
  DocumentDeliveryContact,
  DeliveryIntegrationHint,
  MultiSendResult,
} from "./document-delivery-core";
export {
  contactOptionsForDelivery,
  deliveryIntegrationFromConfig,
  documentPublicUrl,
  parseEmailRecipients,
  parsePhoneRecipients,
  quoteDeliveryDefaultMessages,
  summarizeMultiSend,
} from "./document-delivery-core";

import { sendSystemEmail } from "./sendgrid";
import { sendWhatsAppMessage } from "./whatsapp";
import { summarizeMultiSend, type MultiSendResult } from "./document-delivery-core";

export async function sendEmailsToMany(input: {
  companyId: string;
  recipients: string[];
  subject: string;
  text: string;
}): Promise<MultiSendResult> {
  const results: Array<{ target: string; ok: boolean; message: string }> = [];
  for (const to of input.recipients) {
    const result = await sendSystemEmail({
      companyId: input.companyId,
      to,
      subject: input.subject,
      text: input.text,
    });
    results.push({ target: to, ok: result.ok, message: result.message });
  }
  return summarizeMultiSend(results);
}

export async function sendWhatsAppToMany(input: {
  companyId: string;
  recipients: string[];
  text: string;
}): Promise<MultiSendResult> {
  const results: Array<{ target: string; ok: boolean; message: string }> = [];
  for (const phone of input.recipients) {
    const result = await sendWhatsAppMessage({
      companyId: input.companyId,
      phone,
      text: input.text,
    });
    results.push({ target: phone, ok: result.ok, message: result.message });
  }
  return summarizeMultiSend(results);
}