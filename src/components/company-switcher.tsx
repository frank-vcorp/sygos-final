"use client";

import { usePathname } from "next/navigation";
import { switchCompanyAction } from "@/app/auth-actions";

export function CompanySwitcher({
  activeCompanyId,
  companyDotClass,
  companies,
}: {
  activeCompanyId: string | null;
  companyDotClass: string;
  companies: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();

  return (
    <form
      action={switchCompanyAction}
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/70 py-0.5 pl-2.5 pr-2"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${companyDotClass}`} aria-hidden />
      <input type="hidden" name="next" value={pathname || "/panel"} />
      <select
        key={activeCompanyId ?? "none"}
        name="companyId"
        defaultValue={activeCompanyId ?? companies[0]?.id ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-6 min-w-0 max-w-48 cursor-pointer rounded-md border-0 bg-transparent pr-1 text-xs font-semibold text-slate-800 focus:outline-none"
        aria-label="Empresa activa"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </form>
  );
}
