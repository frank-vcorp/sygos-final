"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({
  groups,
}: {
  groups: Array<{ title: string | null; links: Array<{ href: string; label: string; createHref?: string }> }>;
}) {
  const path = usePathname();
  return (
    <nav className="px-2 pb-4">
      {groups.map((group) => (
        <div key={group.title ?? "inicio"} className="mb-3">
          {group.title ? <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{group.title}</p> : null}
          {group.links.map((link) => {
            const active = path === link.href || (link.href !== "/inicio" && path.startsWith(`${link.href}/`));
            return (
              <div key={link.href} className={`flex items-center rounded-md ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f5f6]"}`}>
                <Link href={link.href} className={`block min-w-0 flex-1 px-3 py-1.5 text-sm ${active ? "font-medium text-[var(--accent)]" : ""}`}>
                  {link.label}
                </Link>
                {link.createHref ? (
                  <Link href={link.createHref} aria-label={`Alta rápida de ${link.label}`} title={`Alta rápida de ${link.label}`} className="px-2 text-base font-semibold leading-none text-[var(--accent)]">
                    +
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
