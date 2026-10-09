import { TextLink } from "@/components/ui";

export function ClientNameLink({
  clientId,
  name,
  isSystem = false,
  canEdit,
}: {
  clientId: string;
  name: string;
  isSystem?: boolean;
  canEdit: boolean;
  className?: string;
}) {
  const label = isSystem ? "SYSTRON · intercompañía" : name;
  if (!canEdit || isSystem) return <>{label}</>;
  return <TextLink href={`/clientes/${clientId}`}>{name}</TextLink>;
}

/** Abre la ficha del cliente en la sección de contactos. */
export function ContactNameLink({
  clientId,
  name,
  canEdit,
}: {
  clientId: string;
  name: string;
  canEdit: boolean;
  className?: string;
}) {
  if (!canEdit) return <>{name}</>;
  return <TextLink href={`/clientes/${clientId}#contactos`}>{name}</TextLink>;
}
