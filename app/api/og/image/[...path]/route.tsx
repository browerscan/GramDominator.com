import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Dynamic OG image generator for static pages
 * Handles requests like /api/og/image/default, /api/og/image/tools, etc.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  // Join path parts to get the image name (e.g., "default", "tools", "about")
  const imageName = path.join("/") || "default";

  // Map image names to page titles
  const titles: Record<string, string> = {
    default: "GramDominator",
    tools: "Creator Tools | GramDominator",
    about: "About GramDominator",
    contact: "Contact GramDominator",
    trends: "TikTok Trends | GramDominator",
  };

  const descriptions: Record<string, string> = {
    default: "Viral Audio Intelligence",
    tools: "Free TikTok watermark remover and AI bio generator",
    about: "Track what is rising before it peaks",
    contact: "Get in touch with the GramDominator team",
    trends: "Live TikTok audio trends and growth signals",
  };

  const title = titles[imageName] ?? titles.default;
  const description = descriptions[imageName] ?? descriptions.default;

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        background:
          "linear-gradient(135deg, #0f172a 0%, #111827 35%, #1f2937 100%)",
        color: "#f9fafb",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          padding: "60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          GramDominator
        </div>
        <div
          style={{
            marginTop: "32px",
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: "800px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: "24px",
            fontSize: "28px",
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {description}
        </div>
        <div
          style={{
            marginTop: "48px",
            fontSize: "18px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          gramdominator.com
        </div>
      </div>
      <div
        style={{
          width: "320px",
          position: "relative",
          padding: "40px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "30px",
            borderRadius: "28px",
            background:
              "radial-gradient(circle at 30% 30%, rgba(255, 122, 61, 0.22), transparent 55%), radial-gradient(circle at 70% 70%, rgba(72, 216, 193, 0.18), transparent 60%)",
            filter: "blur(12px)",
          }}
        />
        <div
          style={{
            position: "relative",
            borderRadius: "24px",
            width: "100%",
            height: "280px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#0b1220",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              opacity: 0.3,
            }}
          >
            GD
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
