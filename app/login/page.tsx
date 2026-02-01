"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Read ?next=... without useSearchParams (avoids Next build/Suspense issues)
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const sp = new URLSearchParams(window.location.search);
    return sp.get("next") || "/";
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClientComponentClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // IMPORTANT: no onboarding, no profile calls.
      // Just go to nextPath or home.
      router.replace(nextPath || "/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Login fehlgeschlagen");
    } finally {
      setLoading(false);
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
      </form>
    </div>
  );
}
