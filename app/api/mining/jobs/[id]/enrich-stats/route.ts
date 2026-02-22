import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * GET /api/mining/jobs/[id]/enrich-stats
 * Proxy to backend enrich-stats endpoint
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const jobId = params.id;

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization");

    const response = await fetch(
      `${BACKEND_URL}/api/mining/jobs/${jobId}/enrich-stats`,
      {
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in enrich-stats route:", error);
    return NextResponse.json(
      { error: "Failed to get enrich stats" },
      { status: 500 }
    );
  }
}
