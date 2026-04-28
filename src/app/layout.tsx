import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const themeBootScript = `
try {
  var theme = window.localStorage.getItem("neuralcast:theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  }
} catch (_) {}
`;

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
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
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
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
