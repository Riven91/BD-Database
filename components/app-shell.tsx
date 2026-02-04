import Image from "next/image";
import Link from "next/link";

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
  return (
    <div className="min-h-screen bg-base-950 text-text-base">
      <header className="border-b border-base-800 bg-base-900">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
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
          <nav className="flex items-center gap-4 text-sm text-text-muted">
            <Link href="/" className="transition hover:text-text-base">
              Dashboard
            </Link>
            <Link href="/labels" className="transition hover:text-text-base">
              Labels
            </Link>
            <Link href="/import" className="transition hover:text-text-base">
              Import
            </Link>
            <Link href="/payboard" className="transition hover:text-text-base">
              Payboard
            </Link>
            <Link href="/artists" className="transition hover:text-text-base">
              Artists
            </Link>
            <Link href="/calendar" className="transition hover:text-text-base">
              Kalender
            </Link>
            <Link href="/templates" className="transition hover:text-text-base">
              Templates
            </Link>
          </nav>
        </div>
      </header>
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
