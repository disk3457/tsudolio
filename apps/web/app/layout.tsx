import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "./register-service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tsudolio",
  description: "Operational groupware for municipalities, hospitals, and private organizations.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
