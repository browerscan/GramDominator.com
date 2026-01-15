import { Ai } from "@cloudflare/ai";
import type { Env } from "./types";

// Import logger conditionally for worker environment
let logger: typeof import("../../lib/logger").logger;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loggerModule = require("../../lib/logger");
  logger = loggerModule.logger;
} catch {
  // Fallback to console if logger module not available in worker context
  logger = {
    error: (...args: unknown[]) => console.error("[AiTagger]", ...args),
    warn: (...args: unknown[]) => console.warn("[AiTagger]", ...args),
    info: (...args: unknown[]) => console.info("[AiTagger]", ...args),
    debug: (...args: unknown[]) => console.log("[AiTagger]", ...args),
    exception: (error: Error, context?: Record<string, unknown>) => {
      console.error("[AiTagger]", error.message, context);
    },
  };
}

interface TagResult {
  genre: string;
  vibe: string;
}

const DEFAULT_TAGS: TagResult = { genre: "unknown", vibe: "mixed" };

const CANONICAL_GENRES: Record<string, string> = {
  pop: "pop",
  hiphop: "hip-hop",
  "hip-hop": "hip-hop",
  rap: "hip-hop",
  electronic: "electronic",
  edm: "electronic",
  dance: "dance",
  rock: "rock",
  indie: "indie",
  rnb: "r&b",
  "r&b": "r&b",
  latin: "latin",
  classical: "classical",
  soundtrack: "soundtrack",
};

const CANONICAL_VIBES: Record<string, string> = {
  energetic: "energetic",
  hype: "energetic",
  upbeat: "energetic",
  chill: "chill",
  calm: "chill",
  sad: "sad",
  moody: "sad",
  funny: "funny",
  comedic: "funny",
  romantic: "romantic",
  dreamy: "dreamy",
  dark: "dark",
  nostalgic: "nostalgic",
  aggressive: "aggressive",
  workout: "gym",
  gym: "gym",
  motivational: "gym",
  dance: "dance",
};

const FALLBACK_KEYWORDS: Array<{ token: string; vibe: string }> = [
  { token: "sad", vibe: "sad" },
  { token: "slow", vibe: "sad" },
  { token: "love", vibe: "romantic" },
  { token: "chill", vibe: "chill" },
  { token: "gym", vibe: "gym" },
  { token: "workout", vibe: "gym" },
  { token: "dance", vibe: "dance" },
  { token: "funny", vibe: "funny" },
  { token: "comedy", vibe: "funny" },
  { token: "hype", vibe: "energetic" },
  { token: "viral", vibe: "energetic" },
];

export async function tagAudioWithAI(
  env: Env,
  title: string,
  author: string,
): Promise<TagResult> {
  if (!env.AI) return heuristicTags(title, author);

  const ai = new Ai(env.AI);
  const prompt = `Classify this song for TikTok usage.
Song: "${title}" by "${author}".
Return ONLY a JSON object: {"genre": "Pop/Rap/Electronic/etc", "vibe": "Energetic/Sad/Funny/Chill"}`;

  try {
    const response = await ai.run("@cf/meta/llama-3-8b-instruct", {
      messages: [{ role: "user", content: prompt }],
    });

    const parsed = parseAiResponse(response);
    return normalizeTags(parsed.genre, parsed.vibe);
  } catch (error) {
    logger.error("AI tagging failed", error);
    return heuristicTags(title, author);
  }
}

export function parseAiResponse(value: unknown): TagResult {
  if (typeof value === "object" && value !== null) {
    const maybe = value as { genre?: string; vibe?: string };
    if (maybe.genre && maybe.vibe) {
      return { genre: maybe.genre, vibe: maybe.vibe };
    }
  }

  const text = typeof value === "string" ? value : JSON.stringify(value ?? {});
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return DEFAULT_TAGS;

  try {
    const parsed = JSON.parse(match[0]) as { genre?: string; vibe?: string };
    return {
      genre: parsed.genre ?? DEFAULT_TAGS.genre,
      vibe: parsed.vibe ?? DEFAULT_TAGS.vibe,
    };
  } catch {
    return DEFAULT_TAGS;
  }
}

function normalizeTags(genre: string, vibe: string): TagResult {
  const cleanGenre = normalizeToken(genre);
  const cleanVibe = normalizeToken(vibe);

  const mappedGenre =
    CANONICAL_GENRES[cleanGenre] ?? (cleanGenre || DEFAULT_TAGS.genre);
  const mappedVibe =
    CANONICAL_VIBES[cleanVibe] ?? (cleanVibe || DEFAULT_TAGS.vibe);

  return {
    genre: mappedGenre,
    vibe: mappedVibe,
  };
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function heuristicTags(title: string, author: string): TagResult {
  const haystack = `${title} ${author}`.toLowerCase();
  const matched = FALLBACK_KEYWORDS.find((item) =>
    haystack.includes(item.token),
  );

  return {
    genre: DEFAULT_TAGS.genre,
    vibe: matched?.vibe ?? DEFAULT_TAGS.vibe,
  };
}
