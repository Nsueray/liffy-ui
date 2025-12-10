import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

async function proxyRequest(req: Request): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const targetUrl = new URL("/api/leads/import", BACKEND_URL);

  const method = req.method;
  const headers = new Headers();

  // Auth + content-type forward
  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  // Import genelde POST olduğu için body’yi aynen forward ediyoruz
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();

  const init: RequestInit = {
    method,
    headers,
    body,
  };

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), init);
  } catch (err) {
    console.error("Failed to reach backend /api/leads/import:", err);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 502 }
    );
  }

  const text = await backendRes.text();

  try {
    const json = text ? JSON.parse(text) : null;
    return NextResponse.json(json, { status: backendRes.status });
  } catch {
    return new NextResponse(text, {
      status: backendRes.status,
      headers: {
        "content-type": backendRes.headers.get("content-type") || "text/plain",
      },
    });
  }
}

// POST /api/leads/import → BACKEND_URL/api/leads/import
export async function POST(req: Request) {
  return proxyRequest(req);
}

