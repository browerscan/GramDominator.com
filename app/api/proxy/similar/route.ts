import { NextResponse } from "next/server";
import { fetchSimilarTrends } from "@/lib/proxy-grid";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface SimilarRequest {
  title: string;
  genre?: string;
  maxResults?: number;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SimilarRequest;
    const { title, genre, maxResults = 8 } = payload;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 },
      );
    }

    if (
      maxResults &&
      (typeof maxResults !== "number" || maxResults < 1 || maxResults > 20)
    ) {
      return NextResponse.json(
        { error: "maxResults must be between 1 and 20" },
        { status: 400 },
      );
    }

    const response = await fetchSimilarTrends(title, genre, { maxResults });

    if (response.error) {
      return NextResponse.json(
        { trends: [], error: response.error },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { trends: response.trends },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=7200, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Similar trends API error:", error);
    return NextResponse.json(
      {
        trends: [],
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          endpoint: "similar",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const genre = searchParams.get("genre") || undefined;
  const limit = searchParams.get("limit");

  if (!title) {
    return NextResponse.json(
      { error: "Title parameter is required" },
      { status: 400 },
    );
  }

  const response = await fetchSimilarTrends(title, genre, {
    maxResults: limit ? Number.parseInt(limit, 10) : 8,
  });

  return NextResponse.json(
    { trends: response.trends, error: response.error },
    {
      headers: {
        "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400",
      },
    },
  );
}
