import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          GramDominator
        </Link>
        <nav className="flex items-center gap-6 text-sm text-black/70">
          <Link href="/trends" className="hover:text-black">
            Trends
          </Link>
          <Link href="/tools" className="hover:text-black">
            Tools
          </Link>
          <Link href="/about" className="hover:text-black">
            About
          </Link>
          <Link href="/contact" className="hover:text-black">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
