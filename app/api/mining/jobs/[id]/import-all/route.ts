import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://api.liffy.app";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const body = await request.json();

    // Forward auth header
    const authHeader = request.headers.get("authorization");

    // Create AbortController with 120 second timeout (2 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${API_BASE}/api/mining/jobs/${jobId}/import-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: "Import is taking longer than expected", 
            message: "The import may still be processing in the background. Please check your lists in a few minutes."
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Import all error:", error);
    return NextResponse.json(
      { error: "Failed to import results" },
      { status: 500 }
    );
  }
}
