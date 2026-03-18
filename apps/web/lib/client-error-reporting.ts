"use client";

export type ClientErrorPayload = {
  kind: "window_error" | "unhandled_rejection" | "react_boundary" | "app_router_error";
  message: string;
  stack?: string | undefined;
  componentStack?: string | undefined;
  source?: string | undefined;
  pathname?: string | undefined;
  userAgent?: string | undefined;
  extra?: Record<string, string | number | boolean | null | undefined> | undefined;
};

export const reportClientError = (payload: ClientErrorPayload): void => {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    pathname: payload.pathname ?? window.location.pathname,
    userAgent: payload.userAgent ?? window.navigator.userAgent,
    reportedAt: new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/client-errors", blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Swallow reporter failures to avoid cascading UI errors.
  });
};
