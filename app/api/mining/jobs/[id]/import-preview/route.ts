import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://api.liffy.app";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const body = await request.json();

    // Forward auth header
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${API_BASE}/api/mining/jobs/${jobId}/import-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Import all error:", error);
    return NextResponse.json(
      { error: "Failed to import results" },
      { status: 500 }
    );
  }
}
