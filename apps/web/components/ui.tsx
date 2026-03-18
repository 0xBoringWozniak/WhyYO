"use client";

import * as React from "react";

import { cn } from "../lib/utils";

export const Card = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("rounded-[28px] border border-white/10 bg-panel p-6 shadow-panel backdrop-blur", className)}
    {...props}
  />
);

export const Button = ({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) => (
  <button
    className={cn(
      "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40",
      variant === "primary" && "bg-lime text-black hover:bg-[#ebff71]",
      variant === "secondary" && "bg-[#242424] text-ink hover:bg-[#303030]",
      variant === "ghost" && "bg-transparent text-ink hover:bg-white/5",
      className,
    )}
    {...props}
  />
);

export const Badge = ({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "good" | "warn";
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
      tone === "neutral" && "border-white/10 bg-white/5 text-ink/80",
      tone === "good" && "border-lime/40 bg-lime/10 text-lime",
      tone === "warn" && "border-white/15 bg-white/8 text-white/72",
      className,
    )}
  >
    {children}
  </span>
);

export const InfoTooltip = ({
  content,
  className,
}: {
  content: React.ReactNode;
  className?: string;
}) => (
  <span className={cn("group relative z-20 inline-flex group-hover:z-[90]", className)}>
    <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-white/12 bg-white/6 text-[11px] font-semibold text-white/58 transition group-hover:border-lime/45 group-hover:text-lime">
      i
    </span>
    <span className="pointer-events-none absolute bottom-full left-1/2 z-[110] mb-3 hidden w-[19rem] max-w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-lime/20 bg-[#151515] px-4 py-3 text-sm leading-6 normal-case tracking-normal text-white shadow-[0_18px_44px_rgba(0,0,0,0.52)] group-hover:block">
      {content}
    </span>
  </span>
);
