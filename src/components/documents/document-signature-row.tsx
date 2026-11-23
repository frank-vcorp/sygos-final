export type SignatureSlot = {
  key: string;
  label: string;
  caption: string;
};

export function DocumentSignatureRow({ slots }: { slots: SignatureSlot[] }) {
  return (
    <section className="mt-10 grid gap-10 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
      {slots.map((slot) => (
        <div key={slot.key}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{slot.label}</p>
          <div className="mt-12 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">{slot.caption}</div>
        </div>
      ))}
    </section>
  );
}