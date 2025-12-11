import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

// Shared proxy helper
async function proxyRequest(req: Request, path: string): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const targetUrl = new URL(path, BACKEND_URL);

  const method = req.method;
  const outgoingHeaders = new Headers();

  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) outgoingHeaders.set("authorization", auth);
  if (contentType) outgoingHeaders.set("content-type", contentType);
  outgoingHeaders.set("accept", "application/json");

  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method,
      headers: outgoingHeaders,
      body,
    });

    const text = await backendRes.text();

    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: backendRes.status });
    } catch {
      // Backend returned non-JSON → still return it
      return new NextResponse(text, {
        status: backendRes.status,
        headers: {
          "content-type":
            backendRes.headers.get("content-type") || "text/plain",
        },
      });
    }
  } catch (err) {
    console.error("Error proxying /api/mining/jobs/:id:", err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}

// GET /api/mining/jobs/[id]
export async function GET(req: any, ctx: any) {
  return proxyRequest(req, `/api/mining/jobs/${ctx.params.id}`);
}

// PATCH /api/mining/jobs/[id]
export async function PATCH(req: any, ctx: any) {
  return proxyRequest(req, `/api/mining/jobs/${ctx.params.id}`);
}

// DELETE /api/mining/jobs/[id]
export async function DELETE(req: any, ctx: any) {
  return proxyRequest(req, `/api/mining/jobs/${ctx.params.id}`);
}
