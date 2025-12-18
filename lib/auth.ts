export function getAuthHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined;

  const token = localStorage.getItem("liffy_token");

  if (!token) return undefined;

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function logoutClient() {
  try {
    const headers = getAuthHeaders();
    await fetch("/api/auth/logout", {
      method: "POST",
      headers,
    });
  } catch (err) {
    console.error("Logout request failed:", err);
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("liffy_token");
      localStorage.removeItem("liffy_user");
      localStorage.removeItem("sidebar-collapsed");
    }
  }
}
