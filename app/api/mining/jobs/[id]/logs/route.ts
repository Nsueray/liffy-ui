import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

async function proxyRequest(
  req: Request,
  path: string
): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL is missing" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const targetUrl = new URL(path, BACKEND_URL);

  // Query string'leri forward et
  targetUrl.search = url.search;

  const method = req.method;
  const headers = new Headers();

  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const init: RequestInit = {
    method,
    headers,
    body:
      method === "GET" || method === "HEAD" ? undefined : await req.text(),
  };

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), init);
  } catch (err) {
    console.error("Failed to reach backend /api/mining/jobs/:id/logs:", err);
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

// GET /api/mining/jobs/[id]/logs → BACKEND_URL/api/mining/jobs/{id}/logs
export async function GET(request: any, context: any) {
  const rawId = context?.params?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || !isValidUuid(id)) {
    console.error("Invalid job id for logs API:", id);
    return NextResponse.json(
      {
        error: "Invalid job ID",
        details: `Job ID must be a valid UUID, received: ${String(id)}`,
      },
      { status: 400 }
    );
  }

  return proxyRequest(request as Request, `/api/mining/jobs/${id}/logs`);
}
