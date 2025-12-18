import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function validateJobId(id: string): { valid: boolean; error?: string } {
  if (!id) {
    return { valid: false, error: "Job ID is required" };
  }

  if (id === "undefined" || id === "null") {
    return { valid: false, error: `Invalid job ID: ${id}` };
  }

  if (!isValidUuid(id)) {
    return { valid: false, error: "Job ID must be a valid UUID" };
  }

  return { valid: true };
}

// Bu dosyaya özel küçük proxy helper
async function proxyRequest(
  req: NextRequest,
  jobId: string,
  pathSuffix: string = ""
): Promise<NextResponse> {
  const validation = validateJobId(jobId);
  if (!validation.valid) {
    console.error("Invalid job id for results API:", jobId);
    return NextResponse.json(
      {
        error: validation.error,
        details: `Received job ID: ${jobId}`,
      },
      { status: 400 }
    );
  }

  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL is missing" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const targetPath = `/api/mining/jobs/${jobId}${pathSuffix}`;
  const targetUrl = new URL(targetPath, BACKEND_URL);

  // Query string'leri forward et (page, limit vs.)
  targetUrl.search = url.search;

  const method = req.method;
  const headers = new Headers();

  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const body =
    method === "GET" || method === "HEAD" || method === "DELETE"
      ? undefined
      : await req.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.error("Failed to reach backend /api/mining/jobs/:id/results:", err);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 502 }
    );
  }

  const text = await backendRes.text();

  try {
    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return new NextResponse(text, {
      status: backendRes.status,
      headers: {
        "content-type":
          backendRes.headers.get("content-type") || "text/plain",
      },
    });
  }
}

// GET /api/mining/jobs/[id]/results → BACKEND_URL/api/mining/jobs/{id}/results
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.id, "/results");
}
