import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/locale";
import { PersistentMiniPlayerOverlay } from "@/components/PersistentMiniPlayerOverlay";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import "./globals.css";

const themeBootScript = `
try {
  var theme = window.localStorage.getItem("neuralcast:theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  }
  var resolvedTheme = theme === "light" || theme === "dark"
    ? theme
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", resolvedTheme === "dark" ? "#101317" : "#f4f7fa");
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
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/neuralcast-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/neuralcast-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/neuralcast-apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
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
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <LanguageProvider initialLocale={DEFAULT_LOCALE}>
          <AudioPlayerProvider>
            {children}
            <PersistentMiniPlayerOverlay />
          </AudioPlayerProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
