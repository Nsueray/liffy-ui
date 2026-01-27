import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://api.liffy.app";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Forward auth header
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${API_BASE}/api/mining/jobs/${jobId}/import-preview`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Import preview error:", error);
    return NextResponse.json(
      { error: "Failed to get preview" },
      { status: 500 }
    );
  }
}
