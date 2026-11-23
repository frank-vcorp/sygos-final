export function DocumentFooter({
  issuerName,
  folio,
  extra,
}: {
  issuerName: string;
  folio: string;
  extra?: string | null;
}) {
  return (
    <footer className="mt-10 border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">
      Documento emitido por {issuerName} · {folio}
      {extra ? ` · ${extra}` : null}
    </footer>
  );
}