import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site";

// The display serif for page titles and marks. Self-hosted by Next at build time.
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  // Link-preview pictures resolve against the site's address.
  metadataBase: new URL(siteUrl()),
  title: "warbag",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f0e4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={display.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
