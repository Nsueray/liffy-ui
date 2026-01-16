"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  status: string;
  template_id: string;
  template_name?: string;
  template_subject?: string;
  list_id?: string | null;
  list_name?: string | null;
  sender_id?: string | null;
  sender_email?: string | null;
  sender_name?: string | null;
  recipient_count?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface Recipient {
  id: string;
  email: string;
  name?: string;
  status: string;
  meta?: any;
  sent_at?: string | null;
  last_error?: string | null;
  created_at: string;
}

export default function CampaignDetailPage() {
  useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const pageSize = 50;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;

  // Fetch campaign details and stats
  const fetchCampaign = useCallback(async () => {
    const token = getToken();
    if (!token || !campaignId) return;

    try {
      // Fetch campaign details
      const campRes = await fetch(`${apiBase}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!campRes.ok) {
        if (campRes.status === 404) {
          router.push('/campaigns');
          return;
        }
        throw new Error('Failed to fetch campaign');
      }
      
      const campData = await campRes.json();
      setCampaign(campData);

      // Fetch stats
      const statsRes = await fetch(`${apiBase}/api/campaigns/${campaignId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

    } catch (err: any) {
      setError(err.message);
    }
  }, [apiBase, campaignId, router]);

  // Fetch recipients
  const fetchRecipients = useCallback(async () => {
    const token = getToken();
    if (!token || !campaignId) return;

    try {
      const offset = (currentPage - 1) * pageSize;
      let url = `${apiBase}/api/campaigns/${campaignId}/recipients?limit=${pageSize}&offset=${offset}`;
      
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
        setTotalRecipients(data.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch recipients:', err);
    }
  }, [apiBase, campaignId, currentPage, statusFilter]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCampaign();
      await fetchRecipients();
      setLoading(false);
    };
    loadData();
  }, [fetchCampaign, fetchRecipients]);

  // Refetch recipients when filter or page changes
  useEffect(() => {
    if (!loading) {
      fetchRecipients();
    }
  }, [statusFilter, currentPage]);

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      opened: "bg-purple-100 text-purple-800",
      clicked: "bg-indigo-100 text-indigo-800",
      failed: "bg-red-100 text-red-800",
      bounced: "bg-orange-100 text-orange-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  function getCampaignStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      ready: "bg-blue-100 text-blue-800",
      sending: "bg-green-100 text-green-800",
      paused: "bg-orange-100 text-orange-800",
      completed: "bg-purple-100 text-purple-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  const totalPages = Math.ceil(totalRecipients / pageSize);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading campaign details...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || "Campaign not found"}
        </div>
        <Link href="/campaigns" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to Campaigns
          </Link>
          <h2 className="text-3xl font-bold">{campaign.name}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 text-sm rounded-full font-semibold ${getCampaignStatusBadge(campaign.status)}`}>
              {campaign.status}
            </span>
            <span className="text-gray-500 text-sm">Created {formatDate(campaign.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Campaign Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Template</p>
          <p className="font-medium">{campaign.template_name || campaign.template_subject || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">List</p>
          <p className="font-medium">{campaign.list_name || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Sender</p>
          <p className="font-medium">{campaign.sender_email || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Recipients</p>
          <p className="font-medium text-2xl">{campaign.recipient_count || 0}</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            <p className="text-sm text-gray-500">Sent</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            <p className="text-sm text-gray-500">Delivered</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.opened}</p>
            <p className="text-sm text-gray-500">Opened</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.clicked}</p>
            <p className="text-sm text-gray-500">Clicked</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-sm text-gray-500">Failed</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.bounced}</p>
            <p className="text-sm text-gray-500">Bounced</p>
          </div>
        </div>
      )}

      {/* Recipients Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Recipients</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Filter:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recipients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {statusFilter !== 'all' ? `No recipients with status "${statusFilter}"` : 'No recipients yet'}
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{r.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.name || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.sent_at)}</td>
                  <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate" title={r.last_error || ''}>
                    {r.last_error || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecipients)} of {totalRecipients} recipients
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
