import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://workback-firebase.web.app"),
  applicationName: "Producer's Toolkit",
  title: {
    default: "Workback — Producer's Toolkit",
    template: "%s · Producer's Toolkit",
  },
  description:
    "Production workback calendars for producers, PMs, and creative teams — build, shift, and share client-ready timelines, with estimates and bid specs alongside.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workback",
  },
  openGraph: {
    type: "website",
    siteName: "Producer's Toolkit",
    title: "Workback — Producer's Toolkit",
    description:
      "Build, shift, and share client-ready production timelines — with estimates and bid specs in one place.",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
