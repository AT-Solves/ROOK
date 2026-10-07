import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ROOK — Your AI Chief of Staff",
  description: "Connect every conversation, decision, commitment, and action.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
