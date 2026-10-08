import Link from "next/link";

export function ClientNameLink({
  clientId,
  name,
  isSystem = false,
  canEdit,
  className = "text-[var(--accent)]",
}: {
  clientId: string;
  name: string;
  isSystem?: boolean;
  canEdit: boolean;
  className?: string;
}) {
  const label = isSystem ? "SYSTRON · intercompañía" : name;
  if (!canEdit || isSystem) return <>{label}</>;
  return <Link href={`/clientes/${clientId}`} className={className}>{name}</Link>;
}

/** Abre la ficha del cliente en la sección de contactos. */
export function ContactNameLink({
  clientId,
  name,
  canEdit,
  className = "text-[var(--accent)]",
}: {
  clientId: string;
  name: string;
  canEdit: boolean;
  className?: string;
}) {
  if (!canEdit) return <>{name}</>;
  return <Link href={`/clientes/${clientId}#contactos`} className={className}>{name}</Link>;
}
