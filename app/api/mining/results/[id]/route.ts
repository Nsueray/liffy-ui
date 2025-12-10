import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

async function proxyRequest(
  req: Request,
  path: string
): Promise<NextResponse> {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined");
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const targetUrl = new URL(path, BACKEND_URL);

  const method = req.method;
  const headers = new Headers();

  // Forward authentication + content type
  const incomingHeaders = req.headers;
  const auth = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");

  if (auth) headers.set("authorization", auth);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  // Only attach body for non-GET methods
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
    console.error("Failed to reach backend /api/mining/results/:id:", err);
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

// PATCH /api/mining/results/[id]
export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  return proxyRequest(req, `/api/mining/results/${id}`);
}

// DELETE /api/mining/results/[id]
export async function DELETE(
  req: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  return proxyRequest(req, `/api/mining/results/${id}`);
}

