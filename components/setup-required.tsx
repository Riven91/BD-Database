import Link from "next/link";

type SetupRequiredProps = {
  title?: string;
  description?: string;
};

export function SetupRequired({
  title = "Setup erforderlich",
  description = "Supabase ENV missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
}: SetupRequiredProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-base-800 bg-base-850 p-6">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
        <div className="text-sm text-text-muted">
          <Link href="/setup-env" className="text-emerald-400 hover:underline">
            README: Supabase Setup öffnen
          </Link>
        </div>
      </div>
    </div>
  );
}
