"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let message = "Login failed";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors
        }
        setError(message);
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Beklediğimiz response: { token: "...", user: {...} } gibi
      const token = data.token || data.access_token || data.jwt;
      if (!token) {
        setError("No token returned from API");
        setLoading(false);
        return;
      }

      // Token'ı localStorage'a kaydet
      if (typeof window !== "undefined") {
        localStorage.setItem("liffy_token", token);
        if (data.user) {
          localStorage.setItem("liffy_user", JSON.stringify(data.user));
        }
      }

      // Başarılı login → Mining Jobs sayfasına yönlendir
      router.push("/mining/jobs");
    } catch (err) {
      console.error("Login error:", err);
      setError("Unexpected error while logging in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl font-semibold tracking-tight mb-2">
            <span className="text-gray-900">li</span>
            <span className="text-orange-500">ff</span>
            <span className="text-gray-900">y</span>
          </div>
          <h1 className="text-lg font-medium text-gray-900">
            Sign in to Liffy
          </h1>
          <p className="text-sm text-gray-500">
            Manage mining jobs, leads and campaigns.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
