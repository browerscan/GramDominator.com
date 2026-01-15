import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { buildFaqSchema } from "@/lib/seo";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-16">
      <section className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div className="space-y-6 fade-up">
          <p className="text-sm uppercase tracking-[0.3em] text-black/50">
            Viral audio intelligence
          </p>
          <h1 className="section-title font-display text-4xl font-semibold leading-tight md:text-5xl">
            Own the soundtrack. Track what is rising before it peaks.
          </h1>
          <p className="max-w-xl text-base text-black/70 md:text-lg">
            GramDominator monitors TikTok audio momentum, captures growth deltas
            every six hours, and turns raw trend data into creator-ready
            signals.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/trends"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white shadow-glow"
            >
              View live trends
            </Link>
            <Link
              href="/trends"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-black/70"
            >
              Explore top audio
            </Link>
          </div>
        </div>
        <div className="grid-fade grid gap-4">
          <div className="glass-card rounded-2xl p-6 shadow-glow">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">
              Live refresh cadence
            </p>
            <p className="mt-4 text-3xl font-semibold">4x daily</p>
            <p className="mt-2 text-sm text-black/60">
              New snapshots every six hours with historical deltas attached.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">
              Signal strength
            </p>
            <p className="mt-4 text-3xl font-semibold">Growth scored</p>
            <p className="mt-2 text-sm text-black/60">
              Growth rate uses play counts first, rank movement second.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">
              Deployment
            </p>
            <p className="mt-4 text-3xl font-semibold">Cloudflare native</p>
            <p className="mt-2 text-sm text-black/60">
              Workers, D1, and Pages keep costs near zero while scaling.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Trend velocity",
            body: "Spot rising audio before it hits the front page with growth rate signals.",
          },
          {
            title: "Creator workflow",
            body: "Use audio cards, hashtags, and CTAs that map to creator decision-making.",
          },
          {
            title: "Programmatic SEO",
            body: "Generate thousands of long-tail audio pages without manual publishing.",
          },
        ].map((item) => (
          <div key={item.title} className="glass-card rounded-2xl p-6">
            <h3 className="font-display text-lg font-semibold">{item.title}</h3>
            <p className="mt-3 text-sm text-black/70">{item.body}</p>
          </div>
        ))}
      </section>

      {/* Structured Data */}
      <JsonLd
        data={buildFaqSchema([
          {
            question: "What is GramDominator?",
            answer:
              "GramDominator is a viral audio intelligence platform that tracks TikTok audio trends with growth metrics refreshed every six hours.",
          },
          {
            question: "How often are TikTok audio trends updated?",
            answer:
              "Trend data refreshes 4 times daily (every six hours) with historical growth deltas attached to each snapshot.",
          },
          {
            question: "How do I use GramDominator to find viral sounds?",
            answer:
              "Browse the live trends page, filter by genre or vibe, and sort by growth rate to identify rising audio before it peaks.",
          },
          {
            question: "Is GramDominator free to use?",
            answer:
              "Yes, GramDominator provides free access to TikTok audio trend data including usage counts, growth rates, and creator insights.",
          },
        ])}
      />
    </div>
  );
}
