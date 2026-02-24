"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

interface Unsubscribe {
  id: string;
  email: string;
  source: string;
  created_at: string;
  campaign_id?: string | null;
  campaign_name?: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface Stats {
  total: number;
  by_source: Record<string, number>;
}

export default function UnsubscribesPage() {
  useAuthGuard();
  const [unsubscribes, setUnsubscribes] = useState<Unsubscribe[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, total_pages: 0 });
  const [stats, setStats] = useState<Stats>({ total: 0, by_source: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`${apiBase}/api/unsubscribes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch unsubscribes");
      }

      const data = await res.json();
      setUnsubscribes(data.unsubscribes || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, total_pages: 0 });
      setStats(data.stats || { total: 0, by_source: {} });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase, page, search, sourceFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData();
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function getSourceBadge(source: string) {
    switch (source) {
      case "sendgrid_unsubscribe":
        return { label: "Unsubscribe Link", className: "bg-gray-100 text-gray-800" };
      case "spam_report":
        return { label: "Spam Report", className: "bg-red-100 text-red-800" };
      case "user_request":
        return { label: "User Request", className: "bg-blue-100 text-blue-800" };
      default:
        return { label: source || "Unknown", className: "bg-gray-100 text-gray-600" };
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
            &larr; Back to Campaigns
          </Link>
          <h2 className="text-3xl font-bold">Unsubscribes</h2>
          <p className="text-sm text-muted-foreground">Contacts who opted out of email communications.</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Unsubscribe Link</p>
          <p className="text-2xl font-bold">{stats.by_source?.sendgrid_unsubscribe || 0}</p>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Spam Reports</p>
          <p className="text-2xl font-bold text-red-600">{stats.by_source?.spam_report || 0}</p>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">User Requests</p>
          <p className="text-2xl font-bold text-blue-600">{stats.by_source?.user_request || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            Search
          </button>
        </form>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All Sources</option>
          <option value="sendgrid_unsubscribe">Unsubscribe Link</option>
          <option value="spam_report">Spam Report</option>
          <option value="user_request">User Request</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">Loading unsubscribes...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {unsubscribes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No unsubscribes yet.
                  </td>
                </tr>
              ) : (
                unsubscribes.map((u) => {
                  const badge = getSourceBadge(u.source);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {u.campaign_id ? (
                          <Link href={`/campaigns/${u.campaign_id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                            {u.campaign_name || "Unknown Campaign"}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page >= pagination.total_pages}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
