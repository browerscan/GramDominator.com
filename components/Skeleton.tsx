export function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-lg bg-white/50 p-4"
        >
          <div className="h-4 w-8 rounded bg-black/10" />
          <div className="h-12 w-12 rounded-full bg-black/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-black/10" />
            <div className="h-3 w-32 rounded bg-black/5" />
          </div>
          <div className="h-4 w-16 rounded bg-black/10" />
          <div className="h-6 w-16 rounded-full bg-black/10" />
          <div className="h-4 w-20 rounded bg-black/10" />
          <div className="h-8 w-20 rounded-full bg-black/10" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-black/10 bg-white/80 p-4"
        >
          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-lg bg-black/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full rounded bg-black/10" />
              <div className="h-3 w-2/3 rounded bg-black/5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="h-4 w-20 rounded bg-black/10" />
            <div className="h-6 w-16 rounded-full bg-black/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-black/10 ${className}`}
      style={{ height: "1em" }}
    />
  );
}

export function TitleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-black/10" />
      <div className="h-10 w-64 animate-pulse rounded bg-black/10" />
    </div>
  );
}
