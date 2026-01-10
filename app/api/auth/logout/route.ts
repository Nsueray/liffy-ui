import { NextRequest, NextResponse } from "next/server";

/**
 * FRONTEND-ONLY LOGOUT
 * -------------------
 * ❌ Backend'e gitmez
 * ❌ 404 üretmez
 * ✅ Her zaman 200 döner
 * ✅ Client-side auth crash'lerini engeller
 */

function logoutResponse() {
  const res = NextResponse.json({ success: true });

  // Eğer cookie tabanlı auth eklenirse diye hazır
  res.cookies.set("auth_token", "", {
    path: "/",
    expires: new Date(0),
  });

  return res;
}

export async function POST(_req: NextRequest) {
  return logoutResponse();
}

export async function GET(_req: NextRequest) {
  return logoutResponse();
}
