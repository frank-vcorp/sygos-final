"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({
  groups,
}: {
  groups: Array<{ title: string | null; links: Array<{ href: string; label: string }> }>;
}) {
  const path = usePathname();
  return (
    <nav className="px-2 pb-4">
      {groups.map((group) => (
        <div key={group.title ?? "inicio"} className="mb-3">
          {group.title ? <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{group.title}</p> : null}
          {group.links.map((link) => {
            const active = path === link.href || path.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-1.5 text-sm ${active ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]" : "hover:bg-[#f3f5f6]"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
