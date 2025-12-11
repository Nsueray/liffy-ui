import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * POST /api/mining/jobs/[id]/retry
 * IMPORTANT: Next.js 16 change - params is now a Promise
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params; // Next.js 16 - await params
  const jobId = params.id;

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    
    // Proxy to backend
    const response = await fetch(
      `${BACKEND_URL}/api/mining/jobs/${jobId}/retry`,
      {
        method: "POST",
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in retry route:", error);
    return NextResponse.json(
      { error: "Failed to retry job" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mining/jobs/[id]/retry
 * IMPORTANT: Next.js 16 change - params is now a Promise
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params; // Next.js 16 - await params
  const jobId = params.id;

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;
    
    // Proxy to backend
    const response = await fetch(
      `${BACKEND_URL}/api/mining/jobs/${jobId}/retry?${searchParams}`,
      {
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in retry history route:", error);
    return NextResponse.json(
      { error: "Failed to fetch retry history" },
      { status: 500 }
    );
  }
}
