import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact GramDominator",
  description: "Get in touch with the GramDominator team.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-12">
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">
          Contact
        </p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">
          Get in touch
        </h1>
      </section>

      <section className="mt-10 space-y-6 text-sm text-black/70">
        <p>
          Have questions, feedback, or want to collaborate? We'd love to hear
          from you.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">
          Reach out directly
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <a
            href="mailto:hello@gramdominator.com"
            className="rounded-xl border border-black/10 bg-white/80 p-6 transition hover:border-black/20 hover:bg-black/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-black">Email</h3>
                <p className="text-sm text-black/60">hello@gramdominator.com</p>
              </div>
            </div>
          </a>

          <a
            href="https://twitter.com/gramdominator"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-black/10 bg-white/80 p-6 transition hover:border-black/20 hover:bg-black/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-black">Twitter / X</h3>
                <p className="text-sm text-black/60">@gramdominator</p>
              </div>
            </div>
          </a>

          <a
            href="https://tiktok.com/@gramdominator"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-black/10 bg-white/80 p-6 transition hover:border-black/20 hover:bg-black/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-black">TikTok</h3>
                <p className="text-sm text-black/60">@gramdominator</p>
              </div>
            </div>
          </a>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-black/10 bg-black/5 p-6">
        <h2 className="font-display text-lg font-semibold">
          Looking for trending sounds?
        </h2>
        <p className="mt-2 text-sm text-black/60">
          Check out our live trends page to discover what's viral right now.
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
