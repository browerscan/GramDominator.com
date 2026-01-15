import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora, Space_Grotesk } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { JsonLd } from "@/components/JsonLd";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  getSiteUrl,
} from "@/lib/seo";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "GramDominator | Viral Audio Intelligence",
    template: "%s | GramDominator",
  },
  description:
    "Track TikTok audio trends in real-time. Discover viral sounds before they peak with 4x daily updates and growth analytics.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://gramdominator.com",
  ),
  keywords: [
    "TikTok trends",
    "TikTok audio",
    "viral sounds",
    "music trends",
    "social media analytics",
    "creator tools",
    "TikTok analytics",
  ],
  openGraph: {
    title: "GramDominator | Viral Audio Intelligence",
    description:
      "Track TikTok audio trends in real-time. Discover viral sounds before they peak with 4x daily updates and growth analytics.",
    type: "website",
    images: [
      {
        url: "/api/og/home",
        width: 1200,
        height: 630,
        alt: "GramDominator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GramDominator | Viral Audio Intelligence",
    description:
      "Track TikTok audio trends in real-time. Discover viral sounds before they peak with 4x daily updates and growth analytics.",
    images: ["/api/og/home"],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "theme-color": "#000000",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = getSiteUrl();

  // Build structured data for the site
  const organizationSchema = buildOrganizationSchema({
    sameAs: [
      "https://twitter.com/gramdominator",
      "https://tiktok.com/@gramdominator",
    ],
  });

  const webSiteSchema = buildWebSiteSchema();

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        {/* Preconnect to TikTok CDN for faster audio loading */}
        <link rel="preconnect" href="https://sf16-ies-music-sg.tiktokcdn.com" />
        <link rel="preconnect" href="https://p16-sign-sg.tiktokcdn.com" />
        <link
          rel="dns-prefetch"
          href="https://sf16-ies-music-sg.tiktokcdn.com"
        />
        <link rel="dns-prefetch" href="https://p16-sign-sg.tiktokcdn.com" />
        {/* JSON-LD structured data */}
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
      </head>
      <body className="text-ink">
        <SiteHeader />
        <main className="min-h-screen">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
