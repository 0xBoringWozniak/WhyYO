"use client";

import { useEffect } from "react";

import { reportClientError } from "../lib/client-error-reporting";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      kind: "app_router_error",
      message: error.message || "Unhandled app router error",
      stack: error.stack,
      extra: { digest: error.digest ?? null },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-fog text-ink">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-20">
          <div className="w-full rounded-[28px] border border-[#ff6b6b]/35 bg-[#130d0d] p-8 text-white shadow-panel">
            <div className="text-xs uppercase tracking-[0.2em] text-[#ff6b6b]">Runtime fallback</div>
            <h2 className="mt-4 text-4xl font-semibold">A client-side error interrupted the dashboard</h2>
            <p className="mt-4 text-lg leading-8 text-white/72">
              The error has been reported to the web container logs. Retry once, and if it repeats we can diagnose it
              from `docker compose logs web`.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-lime px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black"
            >
              Retry render
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
