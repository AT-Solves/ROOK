import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Inter } from "next/font/google";

import "./globals.css";

/* Typography system: Cinzel — the ROOK wordmark (Trajan-style capitals of the reference);
   Cormorant Garamond — editorial display headings; Inter — highly readable UI and body text. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: "ROOK — Your AI Chief of Staff",
  description: "Context for higher judgment. Connect every conversation, decision, commitment, and action.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
