import "./globals.css";
import type { Metadata, Viewport } from "next";
import { InstallPwaBanner } from "@/components/install-pwa-banner";

export const metadata: Metadata = {
  title: "Blood Diamond Mini-CRM",
  description: "Internal CRM for Blood Diamond Tattoo",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#0b0f14"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b0f14" />
      </head>
      <body className="min-h-screen bg-base-950 text-text-base">
        {children}
        <InstallPwaBanner />
      </body>
    </html>
  );
}
