import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Shell } from "@/components/shell";
import { JournalProvider } from "@/lib/journal/store";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Intini Journal Suite", template: "%s · Intini Journal Suite" },
  description: "Trading journal con statistiche verificate e report COT della CFTC controllato settimana per settimana.",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body>
        <JournalProvider>
          <Shell>{children}</Shell>
        </JournalProvider>
      </body>
    </html>
  );
}
