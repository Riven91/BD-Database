"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "ui-sans-serif, system-ui", padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>
          Runtime Error (Client)
        </h1>

        <div style={{ marginBottom: 12 }}>
          <strong>Message:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(error?.message || "unknown")}
          </pre>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Digest:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(error?.digest || "none")}
          </pre>
        </div>

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
      </body>
    </html>
  );
}
