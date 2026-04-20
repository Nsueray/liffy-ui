"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  Clock,
  Check,
  X,
  MoreVertical,
  Flag,
  ArrowUpDown,
  Filter,
  Mail,
  MousePointerClick,
  Eye,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  History,
} from "lucide-react";
import { ContactDrawer } from "@/components/ContactDrawer";
import { TopNav } from "@/components/TopNav";

// Types
interface ActionItem {
  id: string;
  person_id: string;
  campaign_id: string | null;
  trigger_reason: string;
  trigger_detail: string;
  priority: number;
  priority_label: string;
  status: string;
  snoozed_until: string | null;
  last_activity_at: string;
  engagement_score: number;
  created_at: string;
  resolved_at: string | null;
  person_email: string;
  person_first_name: string | null;
  person_last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  campaign_name: string | null;
  assigned_to_name: string | null;
}

interface Summary {
  total_open: number;
  p1_count: number;
  p2_count: number;
  p3_count: number;
  p4_count: number;
  snoozed_count: number;
}

// Priority config
const PRIORITY_CONFIG: Record<number, { color: string; bg: string; dot: string; label: string }> = {
  1: { color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500", label: "P1" },
  2: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", label: "P2" },
  3: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500", label: "P3" },
  4: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500", label: "P4" },
};

// Trigger config
const TRIGGER_CONFIG: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  reply_received: { icon: Mail, label: "Reply Received", color: "text-green-600" },
  sequence_exhausted: { icon: AlertTriangle, label: "Sequence Exhausted", color: "text-amber-600" },
  quote_no_response: { icon: Clock, label: "Quote No Response", color: "text-yellow-600" },
  rebooking_due: { icon: RefreshCw, label: "Rebooking Due", color: "text-purple-600" },
  engaged_hot: { icon: MousePointerClick, label: "Engaged (Hot)", color: "text-orange-600" },
  manual_flag: { icon: Flag, label: "Manual Flag", color: "text-blue-600" },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";

export default function ActionScreen() {
  useAuthGuard();
  const router = useRouter();

  const [items, setItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("priority");
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<ActionItem[]>([]);
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);
  const [drawerActionId, setDrawerActionId] = useState<string | null>(null);
  const [emailUsage, setEmailUsage] = useState<{ daily_limit: number; sent_today: number; remaining: number } | null>(null);

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
      const params = new URLSearchParams({ sort: sortBy });
      if (triggerFilter !== "all") params.set("trigger_reason", triggerFilter);

      const [itemsRes, summaryRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/api/actions?${params}`, { headers }),
        fetch(`${API_BASE}/api/actions/summary`, { headers }),
        fetch(`${API_BASE}/api/campaigns/email-usage`, { headers }),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setEmailUsage(data);
      }
    } catch (err) {
      console.error("Failed to fetch actions:", err);
    } finally {
      setLoading(false);
    }
  }, [triggerFilter, sortBy]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_BASE}/api/actions/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status, ...extra }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update action:", err);
    }
  };

  const handleSnooze = (id: string) => {
    const until = new Date();
    until.setDate(until.getDate() + snoozeDays);
    updateStatus(id, "snoozed", { snoozed_until: until.toISOString() });
    setSnoozeId(null);
  };

  const fetchHistory = async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_BASE}/api/actions/history?limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
    setShowHistory(true);
  };

  // Summary bar
  const renderSummary = () => {
    if (!summary) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Card className="border-l-4 border-l-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.total_open}</div>
            <div className="text-xs text-gray-500">Open Items</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{summary.p1_count}</div>
            <div className="text-xs text-gray-500">P1 Urgent</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.p2_count}</div>
            <div className="text-xs text-gray-500">P2 High</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.p3_count}</div>
            <div className="text-xs text-gray-500">P3 Medium</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.p4_count}</div>
            <div className="text-xs text-gray-500">P4 Low</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-500">{summary.snoozed_count}</div>
            <div className="text-xs text-gray-500">Snoozed</div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render action item row
  const renderItem = (item: ActionItem) => {
    const pConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG[3];
    const tConfig = TRIGGER_CONFIG[item.trigger_reason] || TRIGGER_CONFIG.manual_flag;
    const TriggerIcon = tConfig.icon;
    const personName = [item.person_first_name, item.person_last_name].filter(Boolean).join(" ") || item.person_email;

    return (
      <div
        key={item.id}
        className={`flex items-center gap-4 p-4 border rounded-lg mb-2 hover:shadow-sm transition-shadow cursor-pointer ${pConfig.bg}`}
        onClick={() => { setDrawerPersonId(item.person_id); setDrawerActionId(item.id); }}
      >
        {/* Priority dot */}
        <div className="flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${pConfig.dot}`} title={pConfig.label} />
        </div>

        {/* Trigger icon */}
        <div className={`flex-shrink-0 ${tConfig.color}`}>
          <TriggerIcon className="h-5 w-5" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{personName}</span>
            {item.company_name && (
              <span className="text-xs text-gray-500 truncate">@ {item.company_name}</span>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pConfig.color}`}>
              {pConfig.label}
            </Badge>
          </div>
          <div className="text-xs text-gray-600 truncate">{item.trigger_detail}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-gray-400">{tConfig.label}</span>
            {item.campaign_name && (
              <span className="text-[10px] text-gray-400 truncate">Campaign: {item.campaign_name}</span>
            )}
            <span className="text-[10px] text-gray-400">{timeAgo(item.last_activity_at || item.created_at)}</span>
            {item.engagement_score > 0 && (
              <span className="text-[10px] text-orange-500 font-medium">Score: {item.engagement_score}</span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => { e.stopPropagation(); updateStatus(item.id, "done"); }}
            title="Mark Done"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={(e) => { e.stopPropagation(); updateStatus(item.id, "dismissed"); }}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateStatus(item.id, "in_progress")}>
                Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSnoozeId(item.id)}>
                Snooze...
              </DropdownMenuItem>
              {item.person_id && (
                <DropdownMenuItem onClick={() => router.push(`/leads/${item.person_id}`)}>
                  View Contact
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <TopNav actionCount={0} />
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <TopNav actionCount={summary?.total_open} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant={showHistory ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (showHistory) {
                setShowHistory(false);
              } else {
                fetchHistory();
              }
            }}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {!showHistory && renderSummary()}

      {/* Daily Email Usage */}
      {!showHistory && emailUsage && emailUsage.daily_limit > 0 && (
        <div className="mb-6">
          <Card className={emailUsage.sent_today >= emailUsage.daily_limit ? "border-red-300 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Daily Email Usage</span>
                </div>
                <span className={`text-sm font-semibold ${emailUsage.sent_today >= emailUsage.daily_limit ? "text-red-600" : "text-gray-900"}`}>
                  {emailUsage.sent_today.toLocaleString()} / {emailUsage.daily_limit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    emailUsage.sent_today >= emailUsage.daily_limit
                      ? "bg-red-500"
                      : emailUsage.sent_today >= emailUsage.daily_limit * 0.8
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (emailUsage.sent_today / emailUsage.daily_limit) * 100)}%` }}
                />
              </div>
              {emailUsage.sent_today >= emailUsage.daily_limit && (
                <p className="text-xs text-red-600 mt-1">Daily limit reached. New campaigns cannot be started until tomorrow.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters & Sort */}
      {!showHistory && (
        <div className="flex items-center gap-3 mb-4">
          {/* Trigger filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                {triggerFilter === "all" ? "All Triggers" : TRIGGER_CONFIG[triggerFilter]?.label || triggerFilter}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTriggerFilter("all")}>All Triggers</DropdownMenuItem>
              {Object.entries(TRIGGER_CONFIG).map(([key, cfg]) => (
                <DropdownMenuItem key={key} onClick={() => setTriggerFilter(key)}>
                  {cfg.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                {sortBy === "priority" ? "Priority" : sortBy === "recent" ? "Most Recent" : sortBy === "company" ? "Company" : "Engagement"}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy("priority")}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("recent")}>Most Recent</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("company")}>Company</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("engagement")}>Engagement Score</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Snooze modal */}
      {snoozeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-80">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Snooze Action Item</h3>
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm text-gray-600">Snooze for</label>
                <select
                  className="border rounded px-3 py-1.5 text-sm"
                  value={snoozeDays}
                  onChange={(e) => setSnoozeDays(Number(e.target.value))}
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSnoozeId(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleSnooze(snoozeId)}>
                  Snooze
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History view */}
      {showHistory && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Resolved Actions</h2>
          {historyItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No resolved actions yet</p>
            </div>
          ) : (
            historyItems.map((item) => {
              const pConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG[3];
              const personName = [item.person_first_name, item.person_last_name].filter(Boolean).join(" ") || item.person_email;
              return (
                <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg mb-2 opacity-70">
                  <div className={`w-3 h-3 rounded-full ${pConfig.dot}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{personName}</span>
                    <span className="text-xs text-gray-500 ml-2">{item.trigger_detail}</span>
                  </div>
                  <Badge variant={item.status === "done" ? "default" : "secondary"} className="text-[10px]">
                    {item.status}
                  </Badge>
                  <span className="text-[10px] text-gray-400">{timeAgo(item.resolved_at || item.created_at)}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Action items list */}
      {!showHistory && (
        <div>
          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Zap className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-semibold text-gray-600 mb-2">All caught up!</h2>
              <p className="text-sm">No action items right now. New items will appear as engagement signals arrive.</p>
            </div>
          ) : (
            items.map(renderItem)
          )}
        </div>
      )}

      {/* Contact Drawer */}
      {drawerPersonId && (
        <ContactDrawer
          personId={drawerPersonId}
          actionId={drawerActionId}
          onClose={() => { setDrawerPersonId(null); setDrawerActionId(null); }}
          onResolve={(actionId, status) => {
            updateStatus(actionId, status);
            setDrawerPersonId(null);
            setDrawerActionId(null);
          }}
        />
      )}
    </div>
  );
}
