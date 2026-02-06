import "./globals.css";
import type { Metadata, Viewport } from "next";
import { InstallPwaBanner } from "@/components/install-pwa-banner";

export const metadata: Metadata = {
  title: "Blood Diamond Mini-CRM",
  description: "Internal CRM for Blood Diamond Tattoo",
  applicationName: "BD CRM",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b0f14",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png" }]
  }
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
      <body className="min-h-screen bg-base-950 text-text-base">
        {children}
        <InstallPwaBanner />
      </body>
    </html>
  );
}
