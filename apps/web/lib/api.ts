"use client";

import type { ScanResponse } from "@whyyo/shared";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const TRANSIENT_SCAN_RETRY_COUNT = 4;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const readErrorMessage = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { message?: string; error?: string };
      return payload.message ?? payload.error ?? fallback;
    }

    const text = (await response.text()).trim();
    return text ? text.slice(0, 240) : fallback;
  } catch {
    return fallback;
  }
};

const isRetryableStatus = (status: number) => status >= 500 || status === 429;

const postScanRequest = async (path: string, walletAddress: string, fallbackError: string): Promise<ScanResponse> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < TRANSIENT_SCAN_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (response.ok) {
        return (await response.json()) as ScanResponse;
      }

      const message = await readErrorMessage(response, fallbackError);

      if (!isRetryableStatus(response.status) || attempt === TRANSIENT_SCAN_RETRY_COUNT - 1) {
        throw new Error(message);
      }

      lastError = new Error(message);
      await sleep(700 * (attempt + 1));
    } catch (error) {
      lastError = error as Error;

      if (attempt === TRANSIENT_SCAN_RETRY_COUNT - 1) {
        throw lastError;
      }

      await sleep(700 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(fallbackError);
};

export const startScan = async (walletAddress: string): Promise<ScanResponse> => {
  return postScanRequest("/api/v1/scan/start", walletAddress, "Scan request failed");
};

export const refreshScan = async (walletAddress: string): Promise<ScanResponse> => {
  return postScanRequest("/api/v1/scan/refresh", walletAddress, "Refresh request failed");
};
