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
    <nav className="space-y-1 px-3 pb-5">
      {groups.map((group) => {
        const groupActive = group.links.some((link) => path === link.href || path.startsWith(`${link.href}/`));
        const links = group.links.map((link) => {
            const active = path === link.href || path.startsWith(`${link.href}/`);
            return (
              <div key={link.href} className={`flex min-h-10 items-center rounded-lg transition-colors ${active ? "bg-[var(--accent)] text-white" : "text-[#263b55] hover:bg-[var(--accent-soft)]"}`}>
                <Link href={link.href} className="block min-w-0 flex-1 px-3 py-2 text-[14px] font-medium">
                  {link.label}
                </Link>
                {link.createHref ? (
                  <Link href={link.createHref} aria-label={`Alta rápida de ${link.label}`} title={`Alta rápida de ${link.label}`} className={`mr-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg font-semibold leading-none ${active ? "text-white hover:bg-white/15" : "text-[var(--accent)] hover:bg-white"}`}>
                    +
                  </Link>
                ) : null}
              </div>
            );
          });
        if (!group.title) return <div key={`plain-${group.links.map((link) => link.href).join("-")}`} className="space-y-1">{links}</div>;
        return (
          <details key={`${group.title}-${path}`} open={groupActive} className="group rounded-lg">
            <summary className={`flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-[12px] font-bold uppercase tracking-[0.08em] ${groupActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[#edf5f8]"}`}>
              {group.title}
              <span className="text-base transition-transform group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <div className="space-y-1 pb-2">{links}</div>
          </details>
        );
      })}
    </nav>
  );
}
