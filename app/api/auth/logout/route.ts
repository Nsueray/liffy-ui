import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

async function proxyLogout(req: NextRequest): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const targetUrl = new URL("/api/auth/logout", BACKEND_URL);
  const headers = new Headers();

  const auth = req.headers.get("authorization");
  const contentType = req.headers.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("Failed to reach backend /api/auth/logout:", err);
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

export async function POST(request: NextRequest) {
  return proxyLogout(request);
}

export async function GET(request: NextRequest) {
  return proxyLogout(request);
}
