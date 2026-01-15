import { NextResponse } from "next/server";
import { fetchHashtagSuggestions } from "@/lib/proxy-grid";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface HashtagRequest {
  query: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as HashtagRequest;
    const { query } = payload;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 },
      );
    }

    const sanitizedQuery = query.trim().replace(/^#/, "").slice(0, 100);

    const response = await fetchHashtagSuggestions(sanitizedQuery);

    if (response.error) {
      return NextResponse.json(
        { hashtags: [], error: response.error },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { hashtags: response.hashtags },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=7200, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Hashtag API error:", error);
    return NextResponse.json(
      {
        hashtags: [],
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          endpoint: "hashtags",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  const sanitizedQuery = query.trim().replace(/^#/, "").slice(0, 100);
  const response = await fetchHashtagSuggestions(sanitizedQuery);

  return NextResponse.json(
    { hashtags: response.hashtags, error: response.error },
    {
      headers: {
        "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400",
      },
    },
  );
}
