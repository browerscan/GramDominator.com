import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd } from "@/components/JsonLd";
import { buildCanonical, buildFaqSchema, getSiteUrl } from "@/lib/seo";

export const runtime = "edge";
export const revalidate = 900;

export const metadata: Metadata = {
  title: "Creator Tools | GramDominator",
  description:
    "Free TikTok watermark remover and AI bio generator to keep creators in your loop.",
  keywords: [
    "TikTok watermark remover",
    "AI bio generator",
    "creator tools",
    "TikTok tools",
    "social media tools",
    "content creator tools",
    "free creator tools",
  ],
  alternates: { canonical: buildCanonical("/tools") },
  openGraph: {
    title: "Creator Tools | GramDominator",
    description: "Free TikTok watermark remover and AI bio generator.",
    url: buildCanonical("/tools"),
    type: "website",
    images: [
      {
        url: "/api/og/image/tools",
        width: 1200,
        height: 630,
        alt: "Creator Tools | GramDominator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creator Tools | GramDominator",
    description: "Free TikTok watermark remover and AI bio generator.",
    images: ["/api/og/image/tools"],
  },
};

export default function ToolsPage() {
  const siteUrl = getSiteUrl();

  // Build FAQ schema
  const faqSchema = buildFaqSchema([
    {
      question: "Is the watermark remover free?",
      answer:
        "Yes, the base tool is free. Configure your RapidAPI endpoint and start generating clean download links.",
    },
    {
      question: "Do you store my TikTok video URLs?",
      answer:
        "No. Requests are proxied to your configured endpoint and not persisted in GramDominator.",
    },
    {
      question: "Can I customize the AI bio style?",
      answer:
        "Provide your niche and tone—AI will return a short, creator-ready bio in seconds.",
    },
    {
      question: "Are these tools safe to use?",
      answer:
        "Yes. We don't store any data and all processing happens through secure API endpoints. Your privacy is protected.",
    },
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12">
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">
          Free tools
        </p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">
          Creator growth toolkit
        </h1>
        <p className="max-w-2xl text-sm text-black/60">
          Lightweight tools that keep creators in your ecosystem and fuel repeat
          visits.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Link
          href="/tools/watermark-remover"
          className="glass-card rounded-2xl p-6"
        >
          <h2 className="font-display text-lg font-semibold">
            TikTok Watermark Remover
          </h2>
          <p className="mt-2 text-sm text-black/60">
            Get a clean download link for editing.
          </p>
        </Link>
        <Link
          href="/tools/bio-generator"
          className="glass-card rounded-2xl p-6"
        >
          <h2 className="font-display text-lg font-semibold">
            AI Bio Generator
          </h2>
          <p className="mt-2 text-sm text-black/60">
            Generate a creator bio in seconds with AI.
          </p>
        </Link>
      </section>

      <JsonLd data={faqSchema} />
    </div>
  );
}
