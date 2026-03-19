"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ScanResponse } from "@whyyo/shared";

type ScanPhase = "idle" | "connecting" | "scanning" | "ready" | "error";

type ScanStore = {
  phase: ScanPhase;
  scan: ScanResponse | null;
  error: string | null;
  hasHydrated: boolean;
  setPhase: (phase: ScanPhase) => void;
  setScan: (scan: ScanResponse | null) => void;
  setError: (error: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useScanStore = create<ScanStore>()(
  persist(
    (set) => ({
      phase: "idle",
      scan: null,
      error: null,
      hasHydrated: false,
      setPhase: (phase) => set({ phase }),
      setScan: (scan) => set({ scan, phase: scan ? "ready" : "idle", error: null }),
      setError: (error) => set({ error, phase: "error" }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "whyyo.scan-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scan: state.scan,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        state?.setPhase(state.scan ? "ready" : "idle");
      },
    },
  ),
);
