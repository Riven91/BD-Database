"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = String(error?.message || "unknown");
  const digest = String(error?.digest || "none");
  const stack = String((error as any)?.stack || "no stack");

  return (
    <html>
      <body style={{ fontFamily: "ui-sans-serif, system-ui", padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>
          Runtime Error (Client)
        </h1>

        <div style={{ marginBottom: 12 }}>
          <strong>Message:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Digest:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{digest}</pre>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Stack:</strong>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f6f6f6",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ddd",
              fontSize: 12,
              lineHeight: 1.35,
              maxWidth: 1100,
              overflowX: "auto",
            }}
          >
            {stack}
          </pre>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Retry
          </button>

          <button
            onClick={() => navigator.clipboard.writeText(`${msg}\n\n${stack}`)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Copy error + stack
          </button>
        </div>
      </body>
    </html>
  );
}
