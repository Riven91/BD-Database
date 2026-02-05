"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/labels", label: "Labels" },
  { href: "/import", label: "Import" },
  { href: "/payboard", label: "Payboard" },
  { href: "/artists", label: "Artists" },
  { href: "/calendar", label: "Kalender" },
  { href: "/templates", label: "Templates" }
];

export function AppShell({
  title,
  subtitle,
  action,
  children
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base-950 text-text-base">
      <header className="border-b border-base-800 bg-base-900">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Menü öffnen"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-base-700 text-text-base transition hover:bg-base-850 md:hidden"
            >
              <span className="text-xl leading-none">☰</span>
            </button>
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo-diamond-1024.webp"
                alt="Blood Diamond Tattoo Ink"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border border-base-800 object-cover"
              />
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-emerald-200">
                  Blood Diamond
                </div>
                <div className="text-xs text-text-muted">Mini-CRM</div>
              </div>
            </Link>
          </div>
          <nav className="hidden items-center gap-4 text-sm text-text-muted md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "transition hover:text-text-base",
                  pathname === item.href && "text-emerald-200"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed left-0 top-0 h-full w-72 border-r border-base-800 bg-base-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm uppercase tracking-[0.2em] text-emerald-200">Menü</span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Menü schließen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-base-700 text-text-base transition hover:bg-base-850"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-2 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsDrawerOpen(false)}
                  className={clsx(
                    "rounded-md px-3 py-2 text-text-muted transition hover:bg-base-850 hover:text-text-base",
                    pathname === item.href && "bg-base-850 text-emerald-200"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <main className="px-8 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
