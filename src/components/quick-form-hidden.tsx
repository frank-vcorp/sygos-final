import type { QuickFormFieldMap } from "@/lib/quick-form-persist";

export function QuickFormHiddenFields({ values }: { values: QuickFormFieldMap | null }) {
  if (!values) return null;
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function QuickFormDraftNotice({
  label,
  onEdit,
}: {
  label: string;
  onEdit?: () => void;
}) {
  return (
    <p className="rounded-md border border-[#c8e6d0] bg-[var(--ok-soft,#eef8f0)] px-3 py-2 text-sm text-[#1a5c32]">
      {label}
      {onEdit ? (
        <>
          {" "}
          <button type="button" className="font-medium text-[var(--accent)] underline" onClick={onEdit}>
            Editar
          </button>
        </>
      ) : null}
    </p>
  );
}
