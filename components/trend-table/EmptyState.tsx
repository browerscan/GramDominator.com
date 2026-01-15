interface EmptyStateProps {
  onClear: () => void;
}

export function EmptyState({ onClear }: EmptyStateProps) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-black/20 bg-black/[0.02] p-8 text-center">
      <p className="text-sm text-black/60">No results match your filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-sm font-semibold text-blaze underline hover:text-blaze/80"
      >
        Clear filters
      </button>
    </div>
  );
}
