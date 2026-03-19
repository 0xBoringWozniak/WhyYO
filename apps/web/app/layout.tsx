import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ClientErrorReporter } from "../components/client-error-reporter";
import { Providers } from "../components/providers";

export const metadata: Metadata = {
  title: {
    default: "WHY YO?",
    template: "%s",
  },
  applicationName: "WHY YO?",
  appleWebApp: {
    title: "WHY YO?",
  },
  description: "Deterministic DeFi savings analysis for YO vault recommendations.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={
          {
            "--font-display": '"Bebas Neue", "Impact", "Arial Narrow", sans-serif',
            "--font-body": '"Avenir Next", "Helvetica Neue", "Segoe UI", sans-serif',
          } as React.CSSProperties
        }
      >
        <Providers>
          <ClientErrorReporter />
          {children}
        </Providers>
      </body>
    </html>
  );
}
