import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuralCast",
  description: "Live AI and curated radio from NeuralCast and NeuralForge.",
  applicationName: "NeuralCast",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NeuralCast",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/neuralcast-logo.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/neuralcast-logo.png", sizes: "512x512", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f7fa"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
