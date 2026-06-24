"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reporting";

/**
 * Last-resort boundary for crashes in the root layout itself (the in-app
 * ErrorBoundary handles everything below the providers). Must render its own
 * <html>/<body> per Next's App Router contract.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            color: "#1c1c1a",
            background: "#fafaf8",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: "#6f6e69", maxWidth: 360 }}>
            The app hit an unexpected error. Your saved work is safe — try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 6,
              background: "#1c1c1a",
              color: "#fafaf8",
              border: 0,
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
