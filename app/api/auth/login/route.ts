import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

// Basit login proxy: FRONTEND /api/auth/login → BACKEND /api/auth/login
async function proxyLogin(req: Request): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const targetUrl = new URL("/api/auth/login", BACKEND_URL);

  const method = req.method;
  const headers = new Headers();

  const incomingHeaders = req.headers;
  const contentType = incomingHeaders.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

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
    console.error("Failed to reach backend /api/auth/login:", err);
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
        "content-type":
          backendRes.headers.get("content-type") || "text/plain",
      },
    });
  }
}

export async function POST(req: Request) {
  return proxyLogin(req);
}
