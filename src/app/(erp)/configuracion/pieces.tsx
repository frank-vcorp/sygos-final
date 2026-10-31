import Link from "next/link";
import { controlClass } from "@/components/ui";

export function HiddenFields({ fields }: { fields: Record<string, string | undefined | null> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
    </>
  );
}

export function MasterDetail({ list, editor }: { list: React.ReactNode; editor: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.8fr)]">
      <div className="min-w-0">{list}</div>
      <div className="min-w-0 lg:sticky lg:top-20">{editor}</div>
    </div>
  );
}

export function EditorPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
    </div>
  );
}

export function SelectLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`font-semibold underline decoration-slate-300/80 underline-offset-4 hover:text-[#0a477e] hover:decoration-[#0a477e] ${selected ? "text-[#0a477e]" : "text-slate-900"}`}
    >
      {children}
    </Link>
  );
}

export function selectedRowClass(selected: boolean) {
  return selected ? "bg-sky-50/80" : undefined;
}

export function ActiveSelect({ active }: { active?: boolean }) {
  return (
    <select name="active" defaultValue={active === false ? "no" : "si"} className={controlClass}>
      <option value="si">Activa</option>
      <option value="no">Inactiva</option>
    </select>
  );
}
