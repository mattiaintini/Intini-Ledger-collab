"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Ellipsis, Lock } from "lucide-react";
import { NAV } from "./nav";
import { useJournal } from "@/lib/journal/store";

// Barra mobile: le 4 sezioni d'uso quotidiano, il resto sotto "Altro".
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], { href: "/more", label: "Altro", icon: Ellipsis }] as const;
const SECTIONS = ["Trading", "Markets", "Altro"] as const;

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function Logo({ size = 28 }: { size?: number }) {
  return (
    <>
      <Image src="/logo-mi-white.png" alt="Mattia Intini" width={size} height={size} priority className="logo-dark" />
      <Image src="/logo-mi-black.png" alt="Mattia Intini" width={size} height={size} priority className="logo-light" />
    </>
  );
}

function LockButton({ className = "" }: { className?: string }) {
  const { lock, hasPassword, journal } = useJournal();
  if (!hasPassword || !journal) return null;
  return (
    <button onClick={lock} aria-label="Blocca il journal" title="Blocca" className={`flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface-3 ${className}`}>
      <Lock size={16} strokeWidth={1.75} />
    </button>
  );
}

function ProfileFooter() {
  const { journal } = useJournal();
  const name = journal?.profile.name;
  return (
    <div className="mt-auto flex items-center justify-between gap-2 px-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-semibold uppercase">{name ? name[0] : "·"}</span>
        <span className="truncate text-[13px] font-medium">{name || "Journal"}</span>
      </div>
      <LockButton />
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const moreActive = ["/calendar", "/tools", "/news", "/settings", "/more"].some((h) => isActive(path, h));

  return (
    <div className="min-h-dvh md:flex">
      {/* Mac: sidebar in materiale, sezioni, profilo in fondo */}
      <aside className="material sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col px-3 pb-4 pt-5 md:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="text-[15px] font-semibold">Journal Suite</span>
        </Link>
        <nav className="flex flex-col gap-4">
          {SECTIONS.map((sec) => (
            <div key={sec}>
              <p className="mb-1 px-2 text-[11px] font-semibold text-muted">{sec}</p>
              <div className="flex flex-col gap-px">
                {NAV.filter((n) => n.section === sec).map(({ href, label, icon: Icon }) => {
                  const active = isActive(path, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-8 items-center gap-2.5 rounded-[6px] px-2 text-[13px] ${active ? "bg-surface-3 font-semibold text-fg" : "font-medium text-fg/85"}`}
                    >
                      <Icon size={16} strokeWidth={1.75} className={active ? "text-fg" : "text-muted"} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <ProfileFooter />
      </aside>

      <div className="min-w-0 flex-1">
        <main className="px-4 pb-[calc(49px+env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+16px)] md:px-10 md:pb-16 md:pt-9">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      {/* iPhone: tab bar 49pt in materiale */}
      <nav className="material fixed inset-x-0 bottom-0 z-20 grid h-[calc(49px+env(safe-area-inset-bottom))] grid-cols-5 border-t-[0.5px] border-line pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/more" ? moreActive : isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? "text-fg" : "text-subtle"}`}>
              <Icon size={24} strokeWidth={active ? 2 : 1.6} />
              {label === "COT Report" ? "COT" : label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
