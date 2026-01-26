"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browserClient";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
    const profileResponse = await fetch("/api/profile", { method: "POST" });
    if (profileResponse.ok) {
      const payload = await profileResponse.json();
      if (!payload.profile?.location_id) {
        router.push("/onboarding");
        return;
      }
    }
    router.push("/");
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
