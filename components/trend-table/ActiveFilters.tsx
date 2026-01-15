interface ActiveFiltersProps {
  filteredCount: number;
  totalCount: number;
  onClear: () => void;
}

export function ActiveFilters({
  filteredCount,
  totalCount,
  onClear,
}: ActiveFiltersProps) {
  return (
    <div className="mt-3 flex items-center gap-3 text-xs text-black/50">
      <span>
        Showing {filteredCount} of {totalCount} results
      </span>
      <button
        type="button"
        onClick={onClear}
        className="font-semibold text-blaze underline hover:text-blaze/80"
      >
        Clear all filters
      </button>
    </div>
  );
}
