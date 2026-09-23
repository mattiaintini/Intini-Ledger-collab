"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Ellipsis, Lock } from "lucide-react";
import { NAV } from "./nav";
import { useJournal } from "@/lib/journal/store";

// Barra mobile: le 4 sezioni d'uso quotidiano, il resto sotto "More".
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], { href: "/more", label: "More", icon: Ellipsis }];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function Logo({ size = 32 }: { size?: number }) {
  return (
    <>
      <Image src="/logo-mi-white.png" alt="Mattia Intini" width={size} height={size} priority className="logo-dark" />
      <Image src="/logo-mi-black.png" alt="Mattia Intini" width={size} height={size} priority className="logo-light" />
    </>
  );
}

function UserBox() {
  const { journal, lock, hasPassword } = useJournal();
  if (!journal) return null;
  return (
    <div className="flex items-center gap-3">
      {journal.profile.name && <span className="label text-fg">{journal.profile.name}</span>}
      {hasPassword && (
        <button onClick={lock} aria-label="Blocca il journal" title="Blocca" className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:border-line-strong hover:text-fg">
          <Lock size={14} />
        </button>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const moreActive = ["/calendar", "/tools", "/news", "/settings", "/more"].some((h) => isActive(path, h));

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop: sidebar fissa */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-bg px-3 py-5 md:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <Logo />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-[0.02em]">INTINI</span>
            <span className="block text-xs text-muted">Journal Suite</span>
          </span>
        </Link>
        <nav className="mt-8 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[var(--radius-ui)] border px-3 py-2.5 ${
                  active ? "border-line-strong bg-surface-2 text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-3 text-[11px] leading-snug text-subtle">v10 · dati salvati solo in questo browser</p>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barra in alto: titolo e utente (desktop), logo e utente (mobile) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md md:px-8">
          <Link href="/" className="flex items-center gap-2.5 md:hidden">
            <Logo size={28} />
            <span className="text-sm font-semibold">INTINI</span>
          </Link>
          <p className="hidden text-sm md:block">
            <span className="font-semibold tracking-[0.04em]">INTINI</span> <span className="text-muted">JOURNAL SUITE</span>
          </p>
          <UserBox />
        </header>

        <main className="px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-6">
          <div className="mx-auto max-w-[1560px]">{children}</div>
        </main>
      </div>

      {/* Mobile: tab bar in basso */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/more" ? moreActive : isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-fg" : "text-subtle"}`}>
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              {label === "COT Report" ? "COT" : label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
