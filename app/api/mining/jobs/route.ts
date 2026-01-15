import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Proxy helper for mining jobs API
 * Handles both JSON and multipart/form-data (file uploads) correctly
 */
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
  const contentType = req.headers.get("content-type") || "";

  // Headers hazırla
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  headers.set("accept", "application/json");

  let body: BodyInit | undefined = undefined;

  if (method !== "GET" && method !== "HEAD") {
    // Multipart form-data (file upload) için BINARY olarak forward et
    if (contentType.includes("multipart/form-data")) {
      // Content-Type header'ı aynen koru (boundary dahil)
      headers.set("content-type", contentType);
      // Body'yi arrayBuffer olarak al - BINARY KORUR
      body = await req.arrayBuffer();
    } 
    // JSON için normal text olarak al
    else if (contentType.includes("application/json")) {
      headers.set("content-type", "application/json");
      body = await req.text();
    }
    // Diğer content type'lar için arrayBuffer kullan (güvenli)
    else {
      if (contentType) headers.set("content-type", contentType);
      body = await req.arrayBuffer();
    }
  }

  const init: RequestInit = {
    method,
    headers,
    body,
  };

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), init);
  } catch (err) {
    console.error("Failed to reach backend /api/mining/jobs:", err);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 502 }
    );
  }

  const text = await backendRes.text();

  // Backend JSON dönüyorsa parse et
  try {
    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    // JSON değilse raw text dön
    return new NextResponse(text, {
      status: backendRes.status,
      headers: {
        "content-type": backendRes.headers.get("content-type") || "text/plain",
      },
    });
  }
}

// GET /api/mining/jobs → BACKEND_URL/api/mining/jobs
export async function GET(req: Request) {
  return proxyRequest(req, "/api/mining/jobs");
}

// POST /api/mining/jobs → BACKEND_URL/api/mining/jobs
export async function POST(req: Request) {
  return proxyRequest(req, "/api/mining/jobs");
}
