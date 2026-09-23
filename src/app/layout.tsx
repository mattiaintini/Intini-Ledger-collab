import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Shell } from "@/components/shell";
import { JournalProvider } from "@/lib/journal/store";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Intini Journal Suite", template: "%s · Intini Journal Suite" },
  description: "Trading journal con statistiche verificate e report COT della CFTC controllato settimana per settimana.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme lo imposta lo script di avvio prima dell'idratazione
    <html lang="it" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body>
        <JournalProvider>
          <Shell>{children}</Shell>
        </JournalProvider>
      </body>
    </html>
  );
}
