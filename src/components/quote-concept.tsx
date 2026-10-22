import { TECHNICAL_SERVICE_CONCEPT_TITLE } from "@/lib/quote-concept";

export function QuoteConcept({
  concept,
  complement,
  className = "",
}: {
  concept: string;
  complement?: string | null;
  className?: string;
}) {
  const lines = concept.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className={line === TECHNICAL_SERVICE_CONCEPT_TITLE ? "font-semibold text-[#0b1f3a]" : "leading-snug"}>
          {line}
        </p>
      ))}
      {complement ? <p className="mt-1 text-xs italic leading-snug text-[var(--muted)]">{complement}</p> : null}
    </div>
  );
}
