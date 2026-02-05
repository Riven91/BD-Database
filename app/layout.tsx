import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Blood Diamond Mini-CRM",
  description: "Internal CRM for Blood Diamond Tattoo",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#0a0f0f"
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
      </body>
    </html>
  );
}
