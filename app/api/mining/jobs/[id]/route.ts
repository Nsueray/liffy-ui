import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Validate UUID format
 */
function isValidUuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate job ID before proxying
 */
function validateJobId(id: string): { valid: boolean; error?: string } {
  if (!id) {
    return { valid: false, error: "Job ID is required" };
  }
  
  if (id === 'undefined' || id === 'null') {
    return { valid: false, error: `Invalid job ID: ${id}` };
  }
  
  if (!isValidUuid(id)) {
    return { valid: false, error: "Job ID must be a valid UUID" };
  }
  
  return { valid: true };
}

/**
 * Shared proxy helper with validation
 */
async function proxyRequest(
  req: NextRequest,
  jobId: string,
  pathSuffix: string = ""
): Promise<NextResponse> {
  // Validate job ID first
  const validation = validateJobId(jobId);
  if (!validation.valid) {
    return NextResponse.json(
      { 
        error: validation.error,
        details: `Received job ID: ${jobId}`
      },
      { status: 400 }
    );
  }

  // Check backend URL
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  // Build target URL
  const targetPath = `/api/mining/jobs/${jobId}${pathSuffix}`;
  const targetUrl = new URL(targetPath, BACKEND_URL);

  // Prepare headers
  const outgoingHeaders = new Headers();
  const authHeader = req.headers.get("authorization");
  const contentType = req.headers.get("content-type");

  if (authHeader) {
    outgoingHeaders.set("authorization", authHeader);
  }
  if (contentType) {
    outgoingHeaders.set("content-type", contentType);
  }
  outgoingHeaders.set("accept", "application/json");

  // Prepare body
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    try {
      body = await req.text();
    } catch (err) {
      console.error("Error reading request body:", err);
      body = undefined;
    }
  }

  try {
    // Make request to backend
    const backendRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: outgoingHeaders,
      body,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Try to parse as JSON
    const responseText = await backendRes.text();
    
    try {
      const json = responseText ? JSON.parse(responseText) : {};
      
      // Always return JSON even for non-200 responses
      return NextResponse.json(json, { 
        status: backendRes.status,
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } catch (parseErr) {
      // If backend returned non-JSON, wrap it in JSON
      console.error("Backend returned non-JSON:", responseText);
      return NextResponse.json(
        { 
          error: "Invalid response from backend",
          details: responseText.substring(0, 200) // First 200 chars only
        },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("Error proxying to backend:", err);
    
    // Handle timeout specifically
    if (err.name === 'AbortError') {
      return NextResponse.json(
        { error: "Request timeout", details: "Backend took too long to respond" },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to reach backend",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 502 }
    );
  }
}

/**
 * GET /api/mining/jobs/[id]
 * Fetch a single job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyRequest(request, params.id);
}

/**
 * PATCH /api/mining/jobs/[id]
 * Update a job
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyRequest(request, params.id);
}

/**
 * DELETE /api/mining/jobs/[id]
 * Delete/cancel a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyRequest(request, params.id);
}
