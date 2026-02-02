"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

type SessionInfo = {
  hasSession: boolean;
  email: string | null;
  hasAccessToken: boolean;
  accessTokenPrefix: string | null;
  expiresAt: number | null;
};

type WhoamiInfo =
  | {
      status: number;
      body: string;
    }
  | null;

export default function AuthDebugPanel() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [whoami, setWhoami] = useState<WhoamiInfo>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    setError(null);
    try {
      const supabase = getPlainSupabaseBrowser();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = data.session;
      setSessionInfo({
        hasSession: Boolean(session),
        email: session?.user?.email ?? null,
        hasAccessToken: Boolean(session?.access_token),
        accessTokenPrefix: session?.access_token
          ? `${session.access_token.slice(0, 12)}…`
          : null,
        expiresAt: session?.expires_at ?? null
      });
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    }
  };

  const runWhoami = async () => {
    setError(null);
    setWhoami(null);
    try {
      // fetchWithAuth kann Bearer ODER Cookie – entscheidend ist: /api/whoami zeigt Wahrheit
      const response = await fetchWithAuth("/api/whoami");
      const text = await response.text();
      setWhoami({ status: response.status, body: text });
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    }
  };

  useEffect(() => {
    loadSession();
    runWhoami();
  }, []);

  return (
    <div className="rounded border border-green-800 bg-black/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-green-200">Auth Debug</div>
        <div className="flex gap-2">
          <button
            className="rounded border border-green-700 px-2 py-1 hover:bg-green-950"
            onClick={loadSession}
            type="button"
          >
            Refresh Supabase Session (Browser)
          </button>
          <button
            className="rounded border border-green-700 px-2 py-1 hover:bg-green-950"
            onClick={runWhoami}
            type="button"
          >
            Call /api/whoami (Cookie/Bearer)
          </button>
        </div>
      </div>

      {error ? <div className="mt-2 text-red-300">Error: {error}</div> : null}

      <div className="mt-2 text-xs text-green-300">
        Hinweis: Bei Cookie-Auth kann der Supabase-Browser-Session-State leer sein – entscheidend ist /api/whoami.
      </div>

      <div className="mt-2 text-green-100">
        <div className="mb-1 text-xs uppercase text-green-300">
          Supabase Browser Session
        </div>
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(sessionInfo, null, 2)}
        </pre>
      </div>

      <div className="mt-2 text-green-100">
        <div className="mb-1 text-xs uppercase text-green-300">
          /api/whoami response
        </div>
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(whoami, null, 2)}
        </pre>
      </div>
    </div>
  );
}
