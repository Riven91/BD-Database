import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blood Diamond Mini-CRM",
  description: "Internal CRM for Blood Diamond Tattoo"
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
