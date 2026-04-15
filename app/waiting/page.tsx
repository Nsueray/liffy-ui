"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Mail,
  MessageSquare,
  Eye,
  RefreshCw,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/TopNav";
import { ContactDrawer } from "@/components/ContactDrawer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaign_type: string;
  lead_count: number;
  open_rate: number;
  reply_count: number;
  step_info: string | null;
  created_at: string;
}

interface SequenceLead {
  id: string;
  person_id: string | null;
  email: string;
  name: string | null;
  company: string | null;
  campaign_name: string;
  current_step: number;
  total_steps: number;
  next_send_at: string | null;
  status: string;
}

interface Summary {
  active_campaigns: number;
  leads_in_sequence: number;
  total_leads: number;
}

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  sending: { className: "bg-green-100 text-green-700 border-green-300", label: "Sending" },
  scheduled: { className: "bg-blue-100 text-blue-700 border-blue-300", label: "Scheduled" },
  ready: { className: "bg-gray-100 text-gray-600 border-gray-300", label: "Ready" },
  completed: { className: "bg-gray-100 text-gray-500 border-gray-200", label: "Completed" },
};

const SEQ_STATUS_BADGE: Record<string, { className: string }> = {
  active: { className: "bg-green-100 text-green-700 border-green-300" },
  paused: { className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  replied: { className: "bg-red-100 text-red-700 border-red-300" },
  completed: { className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function formatNextSend(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `In ${diffDays} days`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WaitingScreen() {
  useAuthGuard();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sequenceLeads, setSequenceLeads] = useState<SequenceLead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);

  const getHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchData = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_BASE}/api/waiting`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setSequenceLeads(data.sequence_leads || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch waiting data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6">
        <TopNav />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <TopNav />

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.active_campaigns}</div>
              <div className="text-xs text-gray-500">Active Campaigns</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{summary.leads_in_sequence}</div>
              <div className="text-xs text-gray-500">Leads in Sequence</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-500">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.total_leads}</div>
              <div className="text-xs text-gray-500">Total Leads Reached</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Refresh */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Active Campaigns</h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Campaign cards */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-400 mb-8">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No active campaigns</p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {campaigns.map((c) => {
            const badge = STATUS_BADGE[c.status] || STATUS_BADGE.ready;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => router.push(`/campaigns/${c.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {c.campaign_type === "sequence" ? "Sequence" : "Single"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-medium">{c.lead_count} leads</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {c.open_rate}% opened
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {c.reply_count} replies
                    </span>
                    {c.step_info && (
                      <span className="text-blue-500">{c.step_info}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Leads in Sequence */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Leads in Sequence {sequenceLeads.length > 0 && (
          <span className="text-orange-500 ml-1">({sequenceLeads.length} active)</span>
        )}
      </h2>

      {sequenceLeads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No active sequences. Create a campaign to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name / Email</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Company</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Campaign</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Step</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Next Send</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sequenceLeads.map((lead) => {
                const sBadge = SEQ_STATUS_BADGE[lead.status] || SEQ_STATUS_BADGE.active;
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                    onClick={() => {
                      if (lead.person_id) setDrawerPersonId(lead.person_id);
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-xs truncate max-w-[180px]">
                        {lead.name || lead.email}
                      </div>
                      {lead.name && (
                        <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{lead.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[120px]">
                      {lead.company || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[140px]">
                      {lead.campaign_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      {lead.current_step}/{lead.total_steps}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {formatNextSend(lead.next_send_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sBadge.className}`}>
                        {lead.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Contact Drawer */}
      {drawerPersonId && (
        <ContactDrawer
          personId={drawerPersonId}
          actionId={null}
          onClose={() => setDrawerPersonId(null)}
        />
      )}
    </div>
  );
}
