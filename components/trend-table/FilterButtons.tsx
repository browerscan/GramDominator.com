import {
  GENRE_OPTIONS,
  VIBE_OPTIONS,
  type CategoryOption,
} from "@/lib/categories";

interface FilterButtonsProps {
  selectedGenre: string | null;
  selectedVibe: string | null;
  onGenreToggle: (slug: string | null) => void;
  onVibeToggle: (slug: string | null) => void;
}

export function FilterButtons({
  selectedGenre,
  selectedVibe,
  onGenreToggle,
  onVibeToggle,
}: FilterButtonsProps) {
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-black/60">
        <span className="uppercase tracking-[0.2em] text-black/40">Vibes</span>
        {VIBE_OPTIONS.map((option) => (
          <FilterButton
            key={option.slug}
            option={option}
            isSelected={selectedVibe === option.slug}
            onToggle={() =>
              onVibeToggle(selectedVibe === option.slug ? null : option.slug)
            }
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60">
        <span className="uppercase tracking-[0.2em] text-black/40">Genres</span>
        {GENRE_OPTIONS.map((option) => (
          <FilterButton
            key={option.slug}
            option={option}
            isSelected={selectedGenre === option.slug}
            onToggle={() =>
              onGenreToggle(selectedGenre === option.slug ? null : option.slug)
            }
          />
        ))}
      </div>
    </>
  );
}

interface FilterButtonProps {
  option: CategoryOption;
  isSelected: boolean;
  onToggle: () => void;
}

function FilterButton({ option, isSelected, onToggle }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "rounded-full border px-3 py-1 font-semibold transition " +
        (isSelected
          ? "border-black/40 bg-black/10 text-black"
          : "border-black/10 bg-white text-black/60 hover:border-black/20")
      }
    >
      {option.emoji} {option.label}
    </button>
  );
}
