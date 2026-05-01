import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { cookies, headers } from "next/headers";
import { LanguageProvider } from "@/lib/i18n";
import { LOCALE_COOKIE_KEY, resolvePreferredLocale } from "@/lib/locale";
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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const initialLocale = resolvePreferredLocale({
    storedLocale: cookieStore.get(LOCALE_COOKIE_KEY)?.value,
    browserLanguage: requestHeaders.get("accept-language"),
    countryCode: requestHeaders.get("x-vercel-ip-country")
  });

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
