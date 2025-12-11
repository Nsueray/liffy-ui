export function getAuthHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined;

  const token = localStorage.getItem("liffy_token");

  if (!token) return undefined;

  return {
    Authorization: `Bearer ${token}`,
  };
}
