"use client";

/**
 * Global Error Boundary
 * Catches and handles JavaScript errors in React components
 * Enhanced with error recovery and Sentry preparation
 */

import { useEffect } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const errorContext = {
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "unknown",
    };

    logger.exception(error, errorContext);

    // TODO: Send to error reporting service (e.g., Sentry)
    // Sentry.captureException(error, {
    //   tags: { digest: error.digest },
    //   extra: errorContext,
    // });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-black/50">
        Something went wrong
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold">
        We encountered an error
      </h1>
      <p className="mt-3 text-sm text-black/60">
        An unexpected error occurred while processing your request. Our team has
        been notified and we are working to fix it.
      </p>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-black/80 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex rounded-full border border-black/20 px-5 py-2 text-sm font-semibold hover:bg-black/5 transition-colors"
        >
          Go home
        </Link>
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-sm font-medium text-black/70">
            Error details (development only)
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-black/5 p-4 text-xs text-black/80">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        </details>
      )}
    </div>
  );
}
