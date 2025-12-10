import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

// Ortak proxy helper – diğer route'larda da kopyalayıp kullanabiliriz
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

  // Query string'leri de forward et
  targetUrl.search = url.search;

  // Orijinal request'ten body ve method'u al
  const method = req.method;
  const headers = new Headers();

  // Sadece gerekli header'ları kopyalayalım
  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const init: RequestInit = {
    method,
    headers,
    // GET/HEAD dışındaki method'larda body forward edilecek
    body:
      method === "GET" || method === "HEAD" ? undefined : await req.text(),
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

  // Backend JSON dönüyorsa JSON parse etmeye çalış
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

