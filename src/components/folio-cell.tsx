import { RecordLink } from "@/components/ui";

export function FolioCell({ folio, href }: { folio: string | null; href: string | null }) {
  if (!folio) return <span className="text-[var(--muted)]">—</span>;
  if (!href) return <span className="font-medium text-[var(--ink)]">{folio}</span>;
  return <RecordLink href={href}>{folio}</RecordLink>;
}
