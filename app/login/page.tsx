"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browserClient";
import { Button, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = useMemo(
    () => (hasSupabaseEnv ? createBrowserClient() : null),
    [hasSupabaseEnv]
  );
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionCheck, setSessionCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase env vars fehlen. Login aktuell nicht verfügbar.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
    setLoading(false);
  };

  const handleSessionCheck = async () => {
    try {
      const response = await fetch("/api/whoami");
      const payload = await response.json();
      setSessionCheck(JSON.stringify(payload, null, 2));
    } catch (checkError) {
      setSessionCheck(
        JSON.stringify(
          {
            authenticated: false,
            error: checkError instanceof Error ? checkError.message : "Unknown error"
          },
          null,
          2
        )
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-4 rounded-lg border border-base-800 bg-base-850 p-6"
      >
        <div>
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-sm text-text-muted">Blood Diamond Mini-CRM</p>
        </div>
        <Input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Anmelden..." : "Login"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleSessionCheck}
        >
          Check session
        </Button>
        {sessionCheck ? (
          <pre className="whitespace-pre-wrap rounded-md bg-base-900 p-3 text-xs text-text-muted">
            {sessionCheck}
          </pre>
        ) : null}
      </form>
    </div>
  );
}
