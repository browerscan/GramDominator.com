/**
 * CSP Violation Report Endpoint
 * Collects and logs Content Security Policy violation reports
 *
 * This endpoint receives reports from the browser when CSP violations occur.
 * Use these reports to identify inline scripts/styles that need to be migrated
 * to nonce-based implementations.
 */

export const runtime = "edge";

interface CSPViolationReport {
  "csp-report": {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
    "blocked-uri"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    "status-code"?: number;
    "script-sample"?: string;
  };
}

interface ReportingAPISchema {
  type: string;
  age: number;
  url: string;
  user_agent: string;
  body: CSPViolationReport["csp-report"];
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let reportData: CSPViolationReport["csp-report"] | null = null;

    // Handle both traditional CSP report format and Reporting API format
    if (contentType.includes("application/csp-report")) {
      const body = (await request.json()) as CSPViolationReport;
      reportData = body["csp-report"];
    } else if (contentType.includes("application/reports+json")) {
      const reports = (await request.json()) as ReportingAPISchema[];
      if (reports.length > 0 && reports[0].type === "csp-violation") {
        reportData = reports[0].body;
      }
    }

    if (!reportData) {
      return new Response("Invalid report format", { status: 400 });
    }

    // Log the violation for monitoring
    console.error("[CSP Violation]", {
      document: reportData["document-uri"],
      directive: reportData["violated-directive"],
      blocked: reportData["blocked-uri"],
      source: reportData["source-file"],
      line: reportData["line-number"],
      column: reportData["column-number"],
      sample: reportData["script-sample"],
    });

    // In production, you might want to:
    // 1. Store violations in a database for analysis
    // 2. Send alerts for critical violations
    // 3. Aggregate reports to identify patterns

    // Return success immediately to avoid affecting page load
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[CSP Report Error]", error);
    // Still return success to avoid triggering browser retry storms
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET endpoint for health checking the report handler
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ready",
      endpoint: "csp-violation-report",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
