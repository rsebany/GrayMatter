/**
 * Root layout — fonts, theme, global providers, and document metadata.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AppToaster } from "@/components/feedback";
import { Providers } from "@/components/layout/providers";
import { ThemeProvider } from "@/components/layout/theme-provider";

import "./globals.css";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "GrayMatter",
  description:
    "Hippocampus MRI segmentation with Residual U-Net and WebXR visualization.",
  icons: {
    icon: "/assets/logo.png",
  },
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  width: "device-width",
  initialScale: 1,
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased notranslate`}
      >
        <ThemeProvider>
          <Providers>{children}</Providers>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
