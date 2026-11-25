import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/locale";
import { PersistentMiniPlayerOverlay } from "@/components/PersistentMiniPlayerOverlay";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import { PERSISTENT_AUDIO_ELEMENT_CLASS, PERSISTENT_AUDIO_ELEMENT_ID } from "@/lib/persistentAudio";
import { EpisodePlayerProvider } from "@/context/EpisodePlayerContext";
import { EpisodeMiniPlayer } from "@/components/EpisodeMiniPlayer";
import "./globals.css";
import "./studio.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const themeBootScript = `
try {
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", "#0d0e11");
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
  themeColor: "#0d0e11"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} data-theme="dark" className={`${bricolage.variable} ${plusJakarta.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <audio
          id={PERSISTENT_AUDIO_ELEMENT_ID}
          className={PERSISTENT_AUDIO_ELEMENT_CLASS}
          preload="none"
          aria-hidden="true"
        />
        <audio id="neuralcast-episode-audio" className={PERSISTENT_AUDIO_ELEMENT_CLASS} preload="none" aria-hidden="true" />
        <LanguageProvider initialLocale={DEFAULT_LOCALE}>
          <AudioPlayerProvider>
            <EpisodePlayerProvider>
              {children}
              <PersistentMiniPlayerOverlay />
              <EpisodeMiniPlayer />
            </EpisodePlayerProvider>
          </AudioPlayerProvider>
        </LanguageProvider>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
