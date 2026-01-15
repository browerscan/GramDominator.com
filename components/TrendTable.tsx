"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { AudioTrendRow } from "@/lib/types";
import { buildAudioSlug } from "@/lib/slug";
import { GENRE_OPTIONS, VIBE_OPTIONS } from "@/lib/categories";
import { formatNumber, formatPercent, getGrowthLabel } from "@/lib/format";
import { exportToCsv } from "@/lib/export-csv";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { CopyTikTokButton } from "@/components/CopyTikTokButton";
import { useDebounce } from "@/hooks/useDebounce";
import {
  TrendTableHeader,
  FilterButtons,
  MobileCard,
  EmptyState,
  ActiveFilters,
  type FreshnessStatus,
} from "./trend-table";

interface TrendTableProps {
  data: AudioTrendRow[];
  updatedAt?: number | null;
}

const FILTER_PARAM_GENRE = "genre";
const FILTER_PARAM_VIBE = "vibe";
const FILTER_PARAM_QUERY = "q";

function getFreshnessStatus(timestamp?: number | null): FreshnessStatus {
  if (!timestamp) {
    return { label: "Unknown", color: "bg-gray-400", isStale: true };
  }

  const hoursSinceUpdate = (Date.now() - timestamp) / (1000 * 60 * 60);

  if (hoursSinceUpdate < 3) {
    return { label: "Just now", color: "bg-emerald-500", isStale: false };
  }
  if (hoursSinceUpdate < 12) {
    return {
      label: `${Math.floor(hoursSinceUpdate)}h ago`,
      color: "bg-emerald-500",
      isStale: false,
    };
  }
  if (hoursSinceUpdate < 24) {
    return {
      label: `${Math.floor(hoursSinceUpdate)}h ago`,
      color: "bg-amber-500",
      isStale: false,
    };
  }
  return {
    label: `${Math.floor(hoursSinceUpdate / 24)}d ago`,
    color: "bg-red-500",
    isStale: true,
  };
}

export function TrendTable({ data, updatedAt }: TrendTableProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 300);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const genreParam = searchParams.get(FILTER_PARAM_GENRE);
    const vibeParam = searchParams.get(FILTER_PARAM_VIBE);
    const queryParam = searchParams.get(FILTER_PARAM_QUERY);

    if (genreParam) setSelectedGenre(genreParam);
    if (vibeParam) setSelectedVibe(vibeParam);
    if (queryParam) setGlobalFilter(queryParam);

    setIsInitialized(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();
    if (selectedGenre) params.set(FILTER_PARAM_GENRE, selectedGenre);
    if (selectedVibe) params.set(FILTER_PARAM_VIBE, selectedVibe);
    if (debouncedFilter) params.set(FILTER_PARAM_QUERY, debouncedFilter);

    const newUrl = params.toString() ? `?${params.toString()}` : "";
    router.replace(newUrl, { scroll: false });
  }, [selectedGenre, selectedVibe, debouncedFilter, isInitialized, router]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const genreMatch = selectedGenre
        ? item.genre?.toLowerCase() === selectedGenre
        : true;
      const vibeMatch = selectedVibe
        ? item.vibe?.toLowerCase() === selectedVibe
        : true;
      const searchMatch = debouncedFilter
        ? (item.title?.toLowerCase().includes(debouncedFilter.toLowerCase()) ??
            false) ||
          (item.author?.toLowerCase().includes(debouncedFilter.toLowerCase()) ??
            false)
        : true;
      return genreMatch && vibeMatch && searchMatch;
    });
  }, [data, selectedGenre, selectedVibe, debouncedFilter]);

  const handleExportCsv = useCallback(() => {
    const filename =
      selectedGenre || selectedVibe
        ? `gramdominator-${selectedGenre ?? ""}-${selectedVibe ?? ""}-trends.csv`
        : "gramdominator-trends.csv";
    exportToCsv(filteredData, filename);
  }, [filteredData, selectedGenre, selectedVibe]);

  const handleClearFilters = useCallback(() => {
    setSelectedGenre(null);
    setSelectedVibe(null);
    setGlobalFilter("");
  }, []);

  const hasActiveFilters = Boolean(
    selectedGenre || selectedVibe || globalFilter,
  );

  const freshness = getFreshnessStatus(updatedAt);

  const columns = useMemo<ColumnDef<AudioTrendRow>[]>(
    () => [
      {
        header: "Rank",
        accessorKey: "rank",
        cell: ({ row }) => (
          <span className="font-semibold">#{row.original.rank ?? "-"}</span>
        ),
      },
      {
        header: "Audio",
        accessorKey: "title",
        cell: ({ row }) => (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-medium text-black">{row.original.title}</p>
              <p className="text-xs text-black/50">
                {row.original.author ?? "Unknown artist"}
              </p>
            </div>
            <FavoriteButton audio={row.original} variant="icon" />
          </div>
        ),
      },
      {
        header: "Uses",
        accessorKey: "play_count",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {formatNumber(row.original.play_count)}
          </span>
        ),
      },
      {
        header: "Tags",
        accessorKey: "genre",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            {row.original.genre ? (
              <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold text-black/60">
                {row.original.genre}
              </span>
            ) : null}
            {row.original.vibe ? (
              <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold text-black/60">
                {row.original.vibe}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        header: "Momentum",
        accessorKey: "growth_rate",
        cell: ({ row }) => {
          const growth = row.original.growth_rate ?? 0;
          const badge = getGrowthLabel(growth);
          return (
            <div>
              <p className={`text-sm font-semibold ${badge.tone}`}>
                {badge.label}
              </p>
              <p className="text-xs text-black/50">{formatPercent(growth)}</p>
            </div>
          );
        },
      },
      {
        header: "Action",
        accessorKey: "id",
        cell: ({ row }) => {
          const slug = buildAudioSlug(row.original.title, row.original.id);
          return (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/audio/${slug}`}
                className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
              >
                Details
              </Link>
              <a
                href={`https://www.tiktok.com/music/${row.original.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/20 hover:bg-black/5"
              >
                Use audio
              </a>
              <CopyTikTokButton audioId={row.original.id} />
            </div>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter: debouncedFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-glow">
      <TrendTableHeader
        freshness={freshness}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        hasActiveFilters={hasActiveFilters}
        onExport={handleExportCsv}
        shareButton={
          hasActiveFilters ? (
            <ShareButton variant="link" className="!static" />
          ) : undefined
        }
      />

      <FilterButtons
        selectedGenre={selectedGenre}
        selectedVibe={selectedVibe}
        onGenreToggle={setSelectedGenre}
        onVibeToggle={setSelectedVibe}
      />

      {hasActiveFilters && (
        <ActiveFilters
          filteredCount={filteredData.length}
          totalCount={data.length}
          onClear={handleClearFilters}
        />
      )}

      {/* Mobile Card View */}
      <div className="mt-6 md:hidden">
        <div className="grid gap-3">
          {filteredData.map((item) => (
            <MobileCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-black/10 text-xs uppercase tracking-[0.2em] text-black/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-2"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <span className="text-[10px] text-black/40">
                          {{ asc: "▲", desc: "▼" }[
                            header.column.getIsSorted() as string
                          ] ?? ""}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-black/5 transition-colors hover:bg-black/[0.02]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && hasActiveFilters && (
        <EmptyState onClear={handleClearFilters} />
      )}
    </div>
  );
}
