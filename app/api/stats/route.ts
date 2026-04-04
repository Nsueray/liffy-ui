import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(req: Request): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Server misconfiguration: BACKEND_URL is missing" },
      { status: 500 }
    );
  }

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  headers.set("accept", "application/json");

  try {
    const res = await fetch(new URL("/api/stats", BACKEND_URL).href, {
      method: "GET",
      headers,
    });

    const data = await res.json().catch(() => ({ error: "Invalid response" }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Backend unreachable" },
      { status: 502 }
    );
  }
}
