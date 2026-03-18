"use client";

import { cn } from "../lib/utils";
import { getInitials } from "../lib/brand-assets";

export const AssetIcon = ({
  src,
  alt,
  label,
  accent = "#d7ff1f",
  className,
}: {
  src?: string | null;
  alt: string;
  label: string;
  accent?: string;
  className?: string;
}) => {
  if (src) {
    return (
      <span
        className={cn(
          "inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#161616]",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-sm font-semibold text-black",
        className,
      )}
      style={{ backgroundColor: accent }}
    >
      {getInitials(label)}
    </span>
  );
};
