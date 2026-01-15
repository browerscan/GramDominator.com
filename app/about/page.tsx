import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About GramDominator",
  description:
    "Learn how GramDominator helps creators track TikTok audio trends and discover viral sounds before they peak.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-12">
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">
          About
        </p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">
          What is GramDominator?
        </h1>
      </section>

      <section className="mt-10 space-y-6 text-sm text-black/70">
        <p>
          GramDominator is a TikTok audio intelligence platform that helps
          creators, marketers, and growth teams discover trending sounds before
          they peak.
        </p>

        <p>
          We analyze millions of TikTok videos every day to identify which audio
          tracks are gaining momentum. Our algorithm tracks play counts, growth
          rates, and usage patterns to surface breakout sounds early.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">How it works</h2>
        <div className="mt-4 space-y-4">
          {[
            {
              step: "01",
              title: "Data Collection",
              description:
                "We continuously monitor TikTok's trending sounds and collect play counts, ranks, and metadata.",
            },
            {
              step: "02",
              title: "Growth Analysis",
              description:
                "Our algorithm calculates momentum scores based on growth velocity and rank movement.",
            },
            {
              step: "03",
              title: "Categorization",
              description:
                "Each sound is tagged with genre, vibe, and usage context for easy filtering.",
            },
            {
              step: "04",
              title: "Real-Time Updates",
              description:
                "Data refreshes every 6 hours so you always have the latest insights.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <span className="font-mono text-xs text-black/40">
                {item.step}
              </span>
              <div>
                <h3 className="font-semibold text-black">{item.title}</h3>
                <p className="mt-1 text-sm text-black/60">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">
          Who uses GramDominator?
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Content Creators",
              description:
                "Find trending sounds to boost your video reach and engagement.",
            },
            {
              title: "Social Media Managers",
              description:
                "Stay ahead of trends for your brand's TikTok strategy.",
            },
            {
              title: "Musicians & Artists",
              description: "Track how your music is performing on TikTok.",
            },
            {
              title: "Marketing Teams",
              description: "Identify viral audio for influencer campaigns.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-black/10 bg-white/80 p-4"
            >
              <h3 className="font-semibold text-black">{item.title}</h3>
              <p className="mt-1 text-sm text-black/60">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-black/10 bg-black/5 p-6">
        <h2 className="font-display text-lg font-semibold">
          Ready to discover viral sounds?
        </h2>
        <p className="mt-2 text-sm text-black/60">
          Browse the latest trending audio and find your next viral hook.
        </p>
        <Link
          href="/trends"
          className="mt-4 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          View Trends
        </Link>
      </section>
    </div>
  );
}
