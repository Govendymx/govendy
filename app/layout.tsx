import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { AccountTopMenu } from "@/components/AccountTopMenu";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import LocationTracker from "@/components/security/LocationTracker";
import { FloatingMessagesWrapper } from "@/components/FloatingMessagesWrapper";
import { GlobalShell } from "@/components/GlobalShell";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ImpersonationProvider } from "@/components/ImpersonationProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "GoVendy",
  description: "Compra, vende y subasta en línea — la nueva forma de comercio en México",
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AccountTopMenu />
        <LocationTracker />
        <PresenceBeacon role="user" />
        <ImpersonationProvider>
          <ImpersonationBanner />
          {children}
        </ImpersonationProvider>
        <GlobalShell />
        <GlobalShortcuts />
        <FloatingMessagesWrapper />
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics />
      </body>
    </html>
  );
}

