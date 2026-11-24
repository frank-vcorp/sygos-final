export type DocumentDeliveryContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
};

export type DeliveryIntegrationHint = {
  ready: boolean;
  message: string;
};

export function contactOptionsForDelivery(contacts: DocumentDeliveryContact[]) {
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email?.trim() || null,
    phone: contact.phone?.trim() || null,
    isPrimary: Boolean(contact.isPrimary),
  }));
}