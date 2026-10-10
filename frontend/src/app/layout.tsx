import type { Metadata } from "next";
import localFont from "next/font/local";

import { RookThemeProvider } from "@/components/rook/theme";

import "./globals.css";

/* Typography: Cinzel — the ROOK wordmark; Cormorant Garamond — editorial headings; Inter — UI and body text.
   Self-hosted from npm (@fontsource), so builds never depend on a font CDN. */
const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});
const cormorant = localFont({
  src: [
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});
const cinzel = localFont({
  src: [
    { path: "../../node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ROOK — Your AI Chief of Staff",
  description: "Context for higher judgment. Connect every conversation, decision, commitment, and action.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full">
        <RookThemeProvider>{children}</RookThemeProvider>
      </body>
    </html>
  );
}
