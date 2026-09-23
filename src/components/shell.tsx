"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { NAV } from "./nav";

// Barra mobile: le 4 sezioni d'uso quotidiano, il resto sotto "Altro".
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], { href: "/more", label: "Altro", icon: Ellipsis }];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image src="/logo-mi-white.png" alt="Mattia Intini" width={36} height={36} priority />
      <span className="text-sm font-medium tracking-[-0.01em]">Journal Suite</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const moreActive = ["/calendar", "/tools", "/news", "/settings", "/more"].some((h) => isActive(path, h));

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop: sidebar fissa */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-bg px-4 py-6 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[var(--radius-ui)] px-3 py-2 text-sm transition-colors ${
                  active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-3 text-xs text-subtle">v9 · dati salvati solo in questo browser</p>
      </aside>

      {/* Mobile: barra in alto con il logo */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-bg/80 px-4 backdrop-blur-md md:hidden">
        <Brand />
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      {/* Mobile: tab bar in basso */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/more" ? moreActive : isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-fg" : "text-subtle"}`}>
              <Icon size={20} strokeWidth={1.75} className={active ? "text-accent" : ""} />
              {label === "COT Report" ? "COT" : label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
