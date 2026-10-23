import { TextLink } from "@/components/ui";

export function ClientNameLink({
  clientId,
  name,
  isSystem = false,
  canEdit: _canEdit = true,
}: {
  clientId: string;
  name: string;
  isSystem?: boolean;
  /** Conservado por compatibilidad; el enlace al detalle no depende de editar. */
  canEdit?: boolean;
  className?: string;
}) {
  const label = isSystem ? "SYSTRON · intercompañía" : name;
  return <TextLink href={`/clientes/${clientId}`}>{label}</TextLink>;
}

/** Abre la ficha del cliente en la sección de contactos. */
export function ContactNameLink({
  clientId,
  name,
  canEdit: _canEdit = true,
}: {
  clientId: string;
  name: string;
  canEdit?: boolean;
  className?: string;
}) {
  return <TextLink href={`/clientes/${clientId}#contactos`}>{name}</TextLink>;
}
