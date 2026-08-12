import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthProvider } from "./lib/auth";
import { LocaleProvider } from "./lib/i18n";

export const metadata: Metadata = {
  title: "Too Many Games",
  description: "Find a table. Play.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
