import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces, Caveat } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Greenroom · The Crescent",
    template: "%s · Greenroom",
  },
  description:
    "Operating system for independent music venues. Bookings, settlement, advancing — in one place.",
  applicationName: "Greenroom",
  authors: [{ name: "Greenroom" }],
  keywords: [
    "music venue software",
    "independent venues",
    "settlement",
    "venue operations",
    "ticketing",
    "indie music",
  ],
  openGraph: {
    type: "website",
    title: "Greenroom",
    description:
      "Operating system for independent music venues. Bookings, settlement, advancing — in one place.",
    siteName: "Greenroom",
  },
  twitter: {
    card: "summary_large_image",
    title: "Greenroom",
    description: "Operating system for independent music venues.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1814" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout — only the html/body chrome. Internal routes (Mariana's
 * surfaces) get the sidebar from app/(app)/layout.tsx. Public magic-link
 * routes (/view/[token], /sign/[token]) render straight into body so
 * external recipients don't see internal navigation.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} ${caveat.variable} antialiased`}
    >
      <body className="font-sans bg-canvas text-ink-900">{children}</body>
    </html>
  );
}
