import type { ReactNode } from "react";

export interface FreshnessStatus {
  label: string;
  color: string;
  isStale: boolean;
}

interface TrendTableHeaderProps {
  freshness: FreshnessStatus;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  hasActiveFilters: boolean;
  onExport: () => void;
  shareButton?: ReactNode;
}

export function TrendTableHeader({
  freshness,
  globalFilter,
  setGlobalFilter,
  hasActiveFilters,
  onExport,
  shareButton,
}: TrendTableHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-semibold">
            Live audio signals
          </h2>
          <FreshnessIndicator freshness={freshness} />
        </div>
        <p className="text-sm text-black/60">
          Filter by title or artist to find your next viral hook.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={globalFilter} onChange={setGlobalFilter} />
        {hasActiveFilters && shareButton}
        <ExportButton onClick={onExport} />
      </div>
    </div>
  );
}

interface FreshnessIndicatorProps {
  freshness: FreshnessStatus;
}

function FreshnessIndicator({ freshness }: FreshnessIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1">
      <span
        className={
          "h-2 w-2 rounded-full " +
          freshness.color +
          " " +
          (!freshness.isStale ? "animate-pulse" : "")
        }
      />
      <span className="text-xs text-black/60">{freshness.label}</span>
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search audio"
      className="w-full rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-black/70 outline-none transition focus:border-black/20 md:w-64"
    />
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-black/70 transition hover:border-black/20 hover:bg-black/5"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      Export CSV
    </button>
  );
}
