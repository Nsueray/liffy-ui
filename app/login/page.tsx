"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // FAKE AUTH: sadece token yazıyoruz
    if (typeof window !== "undefined") {
      localStorage.setItem("liffy_token", "test-token-12345");
    }

    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8">
        <div className="text-center mb-6">
          <img
            src="/liffy-logo.png"
            alt="Liffy"
            className="mx-auto mb-4 h-12" // burada da önceki halinden biraz büyük
          />
          <h1 className="text-xl font-semibold">Sign in to Liffy</h1>
          <p className="text-gray-500 text-sm">
            Manage mining jobs, leads and campaigns.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full mt-1 rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full mt-1 rounded-md border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black text-white py-2 mt-2 hover:bg-gray-800"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
