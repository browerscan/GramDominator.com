import { NextResponse } from "next/server";
import { fetchRedditPosts } from "@/lib/proxy-grid";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface RedditRequest {
  query: string;
  maxResults?: number;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RedditRequest;
    const { query, maxResults = 5 } = payload;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
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

    const response = await fetchRedditPosts(query, { maxResults });

    if (response.error) {
      return NextResponse.json(
        { posts: [], error: response.error },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { posts: response.posts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Reddit API error:", error);
    return NextResponse.json(
      {
        posts: [],
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          endpoint: "reddit",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const maxResults = searchParams.get("limit");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  const response = await fetchRedditPosts(query, {
    maxResults: maxResults ? Number.parseInt(maxResults, 10) : 5,
  });

  return NextResponse.json(
    { posts: response.posts, error: response.error },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
