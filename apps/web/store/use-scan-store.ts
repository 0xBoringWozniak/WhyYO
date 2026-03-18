"use client";

import { create } from "zustand";

import type { ScanResponse } from "@whyyo/shared";

type ScanPhase = "idle" | "connecting" | "scanning" | "ready" | "error";

type ScanStore = {
  phase: ScanPhase;
  scan: ScanResponse | null;
  error: string | null;
  setPhase: (phase: ScanPhase) => void;
  setScan: (scan: ScanResponse | null) => void;
  setError: (error: string | null) => void;
};

export const useScanStore = create<ScanStore>((set) => ({
  phase: "idle",
  scan: null,
  error: null,
  setPhase: (phase) => set({ phase }),
  setScan: (scan) => set({ scan, phase: scan ? "ready" : "idle", error: null }),
  setError: (error) => set({ error, phase: "error" }),
}));
