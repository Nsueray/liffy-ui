"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { getAuthHeaders } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  Search,
  Globe,
  ExternalLink,
  Loader2,
  Sparkles,
  FileText,
  Building2,
  BookOpen,
  Landmark,
  FolderOpen,
  Pickaxe,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Trash2,
  AlertCircle,
  Filter,
  ChevronUp,
  ChevronDown,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Mail,
  AlertTriangle,
  Zap,
  Info,
  Settings,
  UploadCloud,
  FileType,
  Plus,
  X,
  Factory,
  Link2,
  ScrollText,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface Source {
  url: string;
  source_type: "association" | "directory" | "fair" | "pdf" | "registry" | "other";
  estimated_companies: number;
  has_email_on_page: boolean | "unknown";
  language: string;
  notes: string;
}

// Discovery v2: Source type definitions
type DiscoverySourceType =
  | "trade_fair"
  | "association"
  | "chamber"
  | "business_directory"
  | "company_listing"
  | "trade_portal"
  | "government_trade"
  | "custom_url"
  | "custom_search";

interface SourceTypeCard {
  id: DiscoverySourceType;
  label: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
}

const DISCOVERY_SOURCE_TYPES: SourceTypeCard[] = [
  { id: "trade_fair", label: "Trade Fair", description: "Exhibitor directories", icon: Factory, placeholder: "e.g. Mega Clima Ghana 2025" },
  { id: "association", label: "Association", description: "Member directories", icon: Building2, placeholder: "e.g. HVAC manufacturers association" },
  { id: "chamber", label: "Chamber", description: "Commerce members", icon: Landmark, placeholder: "e.g. Istanbul chamber of commerce" },
  { id: "business_directory", label: "Directory", description: "Business listings", icon: BookOpen, placeholder: "e.g. packaging suppliers Germany" },
  { id: "company_listing", label: "Catalog", description: "Company pages", icon: ScrollText, placeholder: "e.g. textile manufacturers catalog" },
  { id: "trade_portal", label: "Trade Portal", description: "Supplier databases", icon: Globe, placeholder: "e.g. food exporters Turkey" },
  { id: "government_trade", label: "Gov Database", description: "Trade ministries", icon: Landmark, placeholder: "e.g. TOBB exporter list" },
  { id: "custom_url", label: "Custom URL", description: "Paste any URL", icon: Link2, placeholder: "https://example.com/members" },
  { id: "custom_search", label: "Custom Search", description: "Free keyword search", icon: Search, placeholder: "Type any search query..." },
];

const INDUSTRY_OPTIONS = [
  "HVAC", "Food & Beverage", "Construction", "Packaging", "Textiles",
  "Automotive", "Energy", "Electronics", "Healthcare", "Chemicals",
  "Mining", "Agriculture", "Furniture", "Plastics", "Machinery",
  "Logistics", "IT & Software", "Defense", "Tourism", "Other",
];

const COUNTRY_OPTIONS = [
  "Turkey", "Germany", "France", "Italy", "Nigeria", "Ghana", "Morocco",
  "USA", "UK", "China", "India", "UAE", "Spain", "Netherlands", "Belgium",
  "Poland", "Russia", "Brazil", "Mexico", "Egypt", "Saudi Arabia",
  "South Africa", "Japan", "South Korea", "Indonesia", "Iran",
];

type MiningJobStatus = "pending" | "running" | "completed" | "failed" | "needs_manual";

type MiningJob = {
  id: string;
  organizer_id: string;
  name: string;
  type: "url" | "file";
  input: string;
  strategy: string;
  site_profile?: string;
  status: MiningJobStatus;
  progress?: number;
  total_found: number;
  total_emails_raw: number;
  total_prospects_created: number;
  config?: any;
  stats?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
  parent_job_id?: string;
  retry_job_id?: string;
  creator_name?: string | null;
};

type SortField = "created_at" | "name" | "status" | "total_found";
type SortOrder = "asc" | "desc";

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  association: { label: "Association", color: "bg-blue-100 text-blue-700", icon: Building2 },
  fair: { label: "Fair", color: "bg-green-100 text-green-700", icon: Globe },
  pdf: { label: "PDF", color: "bg-red-100 text-red-700", icon: FileText },
  directory: { label: "Directory", color: "bg-yellow-100 text-yellow-700", icon: BookOpen },
  registry: { label: "Registry", color: "bg-purple-100 text-purple-700", icon: Landmark },
  other: { label: "Other", color: "bg-gray-100 text-gray-700", icon: FolderOpen },
};

const MINER_LABELS: Record<string, string> = {
  spaNetworkMiner: "SPA Network",
  aiMiner: "AI",
  playwrightTableMiner: "Table",
  directoryMiner: "Directory",
  documentMiner: "Document/PDF",
  fileMiner: "File Upload",
  httpBasicMiner: "HTTP Basic",
  fullMiner: "Full",
  localMiner: "Local",
};

const FLOW2_BADGES: Record<string, { label: string; className: string }> = {
  skipped: { label: "F2 Skip", className: "bg-gray-100 text-gray-600 border-gray-200" },
  completed: { label: "F2 ✓", className: "bg-green-100 text-green-700 border-green-200" },
  limited: { label: "F2 Limited", className: "bg-orange-100 text-orange-700 border-orange-200" },
  pending: { label: "F2 Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  not_needed: { label: "", className: "" },
};

// ═══════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════

function useMiningJobs(page: number, search: string, statusFilter: MiningJobStatus | "all") {
  const [jobs, setJobs] = useState<MiningJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    total_emails: 0,
  });

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search,
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const res = await fetch(`/api/mining/jobs?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch jobs");

      const data = await res.json();
      setJobs(data.jobs || []);
      setTotalCount(data.total || 0);
      setStats(data.stats || stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setJobs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh for running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some((j) => j.status === "running");
    if (hasRunningJobs) {
      const interval = setInterval(fetchJobs, 5000);
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  return { jobs, loading, error, totalCount, stats, refetch: fetchJobs };
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: MiningJobStatus }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    needs_manual: "bg-orange-100 text-orange-800 border-orange-200",
  };

  const icons: Record<MiningJobStatus, React.ReactNode> = {
    pending: <Clock className="h-3 w-3" />,
    running: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    needs_manual: <AlertTriangle className="h-3 w-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status === "needs_manual" ? "Needs Manual" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function MinerStrategyCell({ job }: { job: MiningJob }) {
  const minerUsed = job.stats?.miner_used;
  const miningMode = job.stats?.mining_mode || job.config?.mining_mode || "full";
  const flow2Status = job.stats?.flow2_status;

  if (!minerUsed) {
    return (
      <span className="text-xs font-medium text-gray-600 capitalize">
        {job.strategy || "auto"}
      </span>
    );
  }

  const minerLabel = MINER_LABELS[minerUsed] || minerUsed;
  const flow2Badge = flow2Status ? FLOW2_BADGES[flow2Status] : null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-800">{minerLabel}</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 capitalize">{miningMode === "full" ? "free" : miningMode}</span>
        {flow2Badge && flow2Badge.label && (
          <span className={`text-[10px] font-medium px-1.5 py-0 rounded border ${flow2Badge.className}`}>
            {flow2Badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color = "gray" }: any) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
        </div>
        <div className={`rounded-lg p-3 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RetryJobButton({
  jobId,
  jobName,
  onRetryComplete,
}: {
  jobId: string;
  jobName?: string;
  onRetryComplete?: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!confirm(`Retry job "${jobName || jobId}"?`)) return;
    setRetrying(true);

    try {
      const response = await fetch(`/api/mining/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to retry job");
      }

      toast.success("Job retry created!");
      if (onRetryComplete) onRetryComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry job");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <button
      onClick={handleRetry}
      disabled={retrying}
      className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
    >
      {retrying ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
          Retrying...
        </>
      ) : (
        "Retry"
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: DISCOVER
// ═══════════════════════════════════════════════════════════════════

function DiscoverTab({ onMineCreated }: { onMineCreated: () => void }) {
  // Source type selection
  const [selectedSourceType, setSelectedSourceType] = useState<DiscoverySourceType | null>(null);

  // Search filters
  const [keyword, setKeyword] = useState("");
  const [industry, setIndustry] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [customUrl, setCustomUrl] = useState("");

  // Results state
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [searchedAt, setSearchedAt] = useState<string | null>(null);

  // Selection state
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const isCustomUrl = selectedSourceType === "custom_url";
  const isCustomSearch = selectedSourceType === "custom_search";
  const currentTypeCard = DISCOVERY_SOURCE_TYPES.find((t) => t.id === selectedSourceType);

  // Toggle country selection
  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  // Toggle source selection
  const toggleSource = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedUrls(new Set(sources.map((s) => s.url)));
  };

  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  // ── Search handler ──
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSourceType) {
      toast.error("Please select a source type first");
      return;
    }

    if (isCustomUrl) {
      if (!customUrl.trim()) {
        toast.error("Please enter a URL");
        return;
      }
      try {
        const res = await fetch("/api/mining/jobs", {
          method: "POST",
          headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "url",
            input: customUrl.trim(),
            name: `Custom URL — ${(() => { try { return new URL(customUrl.trim()).hostname; } catch { return customUrl.trim().slice(0, 40); } })()}`,
            strategy: "auto",
            config: { mining_mode: "full" },
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create mining job");
        }
        toast.success("Mining job created!");
        setCustomUrl("");
        onMineCreated();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create mining job");
      }
      return;
    }

    // FIX 1: keyword is optional — at least one filter required
    const hasAnyFilter = keyword.trim() || industry || selectedCountries.length > 0;
    if (!hasAnyFilter) {
      toast.error("Please enter at least one filter (keyword, industry, or country)");
      return;
    }

    setLoading(true);
    setSources([]);
    setSearchedAt(null);
    setSelectedUrls(new Set());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch("/api/source-discovery", {
        method: "POST",
        headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim() || undefined,
          industry: industry || undefined,
          target_countries: selectedCountries,
          source_type: selectedSourceType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to discover sources");
      }

      const data = await res.json();
      setSources(data.sources || []);
      setSearchedAt(data.searched_at || new Date().toISOString());

      if (data.sources?.length > 0) {
        toast.success(`Found ${data.sources.length} sources`);
      } else {
        toast("No sources found. Try different search terms.", { icon: "🔍" });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Request timed out. Try again with narrower search terms.");
      } else {
        toast.error(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMine = async (source: Source) => {
    try {
      const res = await fetch("/api/mining/jobs", {
        method: "POST",
        headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "url",
          input: source.url,
          name: `Discovery — ${source.source_type}: ${(() => { try { return new URL(source.url).hostname; } catch { return source.url; } })()}`,
          strategy: "auto",
          config: { mining_mode: "full" },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mining job");
      }
      toast.success(`Mining job created for ${(() => { try { return new URL(source.url).hostname; } catch { return source.url; } })()}`);
      onMineCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create mining job");
    }
  };

  const handleMineSelected = async () => {
    if (selectedUrls.size === 0) return;
    setBatchLoading(true);
    try {
      const urls = Array.from(selectedUrls).map((url) => ({ url }));
      const res = await fetch("/api/mining/batch-create", {
        method: "POST",
        headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mining jobs");
      }
      const data = await res.json();
      toast.success(`${data.created} mining jobs created!`);
      if (data.failed > 0) toast.error(`${data.failed} URLs failed`);
      setSelectedUrls(new Set());
      onMineCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create mining jobs");
    } finally {
      setBatchLoading(false);
    }
  };

  const emailIndicator = (value: boolean | "unknown") => {
    if (value === true) return <span className="text-green-600 font-medium" title="Emails on page">Yes</span>;
    if (value === false) return <span className="text-red-500 font-medium" title="No emails on page">No</span>;
    return <span className="text-gray-400" title="Unknown">?</span>;
  };

  return (
    <div>
      {/* ── Source Type Selection — compact, collapses when selected ── */}
      <div className="mb-4">
        {!selectedSourceType ? (
          /* No selection: show all cards in compact grid */
          <>
            <p className="text-sm text-gray-500 mb-3">Select a source type to start discovering</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {DISCOVERY_SOURCE_TYPES.map((st) => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedSourceType(st.id);
                      setSources([]);
                      setSearchedAt(null);
                      setSelectedUrls(new Set());
                    }}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg border border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50 transition-all text-center"
                  >
                    <Icon className="w-5 h-5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 leading-tight">{st.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* Selected: show selected card inline + Change button */
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = currentTypeCard!.icon;
              return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-300 text-orange-700 text-sm font-medium">
                  <Icon className="w-4 h-4" />
                  {currentTypeCard!.label}
                </span>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                setSelectedSourceType(null);
                setSources([]);
                setSearchedAt(null);
                setSelectedUrls(new Set());
              }}
              className="text-xs text-gray-500 hover:text-orange-600 underline"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* ── Filters + Search (inline, shown after source type selection) ── */}
      {selectedSourceType && (
        <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          {isCustomUrl ? (
            <div className="flex gap-3">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/exhibitors"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md transition-colors text-sm"
              >
                <Pickaxe className="w-4 h-4" />
                Mine
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              {/* Keyword */}
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isCustomSearch ? "Search Query" : "Keywords"}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={currentTypeCard?.placeholder || "Enter keywords..."}
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Industry */}
              {!isCustomSearch && (
                <div className="w-[160px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  >
                    <option value="">Any</option>
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Country */}
              {!isCustomSearch && (
                <div className="w-[160px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Country{selectedCountries.length > 0 ? ` (${selectedCountries.length})` : ""}
                  </label>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) toggleCountry(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  >
                    <option value="">Add...</option>
                    {COUNTRY_OPTIONS.filter((c) => !selectedCountries.includes(c)).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search button */}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-md transition-colors text-sm h-[38px]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Searching..." : "Discover"}
              </button>
            </div>
          )}

          {/* Country chips */}
          {!isCustomUrl && !isCustomSearch && selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs cursor-pointer hover:bg-orange-200"
                  onClick={() => toggleCountry(c)}
                >
                  {c} <X className="w-3 h-3" />
                </span>
              ))}
            </div>
          )}

          {loading && (
            <p className="text-xs text-gray-400 mt-2">This may take up to 60 seconds (AI web search)</p>
          )}
        </form>
      )}

      {/* ── Results ── */}
      {searchedAt && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">
              {sources.length} sources found
            </span>
            <span className="text-xs text-gray-400">
              {new Date(searchedAt).toLocaleTimeString()}
            </span>
          </div>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={selectedUrls.size === sources.length ? deselectAll : selectAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {selectedUrls.size === sources.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((source, idx) => {
            const typeConfig = SOURCE_TYPE_CONFIG[source.source_type] || SOURCE_TYPE_CONFIG.other;
            const TypeIcon = typeConfig.icon;
            let hostname = "";
            try { hostname = new URL(source.url).hostname; } catch { hostname = source.url; }
            const isSelected = selectedUrls.has(source.url);

            return (
              <div
                key={idx}
                className={`bg-white border rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                  isSelected ? "border-orange-400 bg-orange-50/30" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => toggleSource(source.url)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                  }`}>
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>

                  {/* Type badge */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0 ${typeConfig.color}`}>
                    <TypeIcon className="w-3 h-3" />
                    {typeConfig.label}
                  </span>

                  {/* URL + notes */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {hostname}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                    {source.notes && (
                      <span className="text-xs text-gray-400 ml-2 hidden sm:inline">{source.notes.slice(0, 80)}{source.notes.length > 80 ? "..." : ""}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className="text-gray-600 font-medium" title="Estimated companies">
                      {source.estimated_companies || "?"} co.
                    </span>
                    <span title="Emails on page">{emailIndicator(source.has_email_on_page)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMine(source); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded transition-colors"
                    >
                      <Pickaxe className="w-3 h-3" />
                      Mine
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom bar: Mine Selected ── */}
      {sources.length > 0 && selectedUrls.size > 0 && (
        <div className="sticky bottom-0 mt-3 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-orange-600">{selectedUrls.size}</span> selected
          </span>
          <button
            type="button"
            onClick={handleMineSelected}
            disabled={batchLoading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-md transition-colors text-sm"
          >
            {batchLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Pickaxe className="w-4 h-4" /> Mine Selected ({selectedUrls.size})</>
            )}
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && sources.length === 0 && !searchedAt && !selectedSourceType && (
        <div className="text-center py-12 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Select a source type above to start discovering</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEW JOB MODAL
// ═══════════════════════════════════════════════════════════════════

function NewJobModal({ onClose, onJobCreated }: { onClose: () => void; onJobCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [jobType, setJobType] = useState<"url" | "file">("url");
  const [name, setName] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [miningMode, setMiningMode] = useState("full");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState("");
  const [configError, setConfigError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (jobType === "url" && !inputUrl) {
      toast.error("Please enter a target URL");
      return;
    }
    if (jobType === "file" && !selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    let parsedConfig: Record<string, unknown> | null = null;
    if (advancedConfig.trim()) {
      try {
        parsedConfig = JSON.parse(advancedConfig.trim());
        setConfigError("");
      } catch {
        setConfigError("Invalid JSON");
        toast.error("Advanced Config contains invalid JSON");
        return;
      }
    }

    setLoading(true);

    try {
      let response;

      if (jobType === "url") {
        response = await fetch("/api/mining/jobs", {
          method: "POST",
          headers: {
            ...(getAuthHeaders() ?? {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "url",
            input: inputUrl,
            name: name || `Mining Job - ${new Date().toLocaleString()}`,
            strategy: "auto",
            config: {
              mining_mode: miningMode,
              ...(parsedConfig || {}),
            },
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile as Blob);
        formData.append("type", "file");
        formData.append("name", name || selectedFile?.name || "File Mining Job");
        formData.append("strategy", "auto");
        if (parsedConfig) {
          formData.append("config", JSON.stringify(parsedConfig));
        }

        const authHeaders = getAuthHeaders() ?? {};
        // @ts-ignore
        delete authHeaders["Content-Type"];

        response = await fetch("/api/mining/jobs", {
          method: "POST",
          headers: authHeaders as HeadersInit,
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to create job");
      }

      toast.success("Mining job started successfully!");
      onJobCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Create New Mining Job</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Type Selection Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setJobType("url")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              jobType === "url"
                ? "text-orange-600 border-b-2 border-orange-600 bg-orange-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Globe className="h-4 w-4" />
            Website / URL
          </button>
          <button
            type="button"
            onClick={() => setJobType("file")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              jobType === "file"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FileText className="h-4 w-4" />
            File Upload
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Job Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={jobType === "url" ? "e.g., Pumps Valves Exhibitors" : "e.g., Client List Import"}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none focus:ring-orange-500"
            />
          </div>

          {/* Dynamic Input */}
          {jobType === "url" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="url"
                    required
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://www.example.com/exhibitors"
                    className="w-full pl-10 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none focus:ring-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the listing page URL. Pagination will be handled automatically.
                </p>
              </div>

              {/* Mining Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mining Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMiningMode("full")}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      miningMode === "full"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Zap className={`h-6 w-6 mb-2 ${miningMode === "full" ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="font-medium text-sm text-gray-900">Free</div>
                    <div className="text-xs text-gray-500 mt-1">~2 minutes</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiningMode("ai")}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      miningMode === "ai"
                        ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      Best
                    </span>
                    <Sparkles className={`h-6 w-6 mb-2 ${miningMode === "ai" ? "text-purple-600" : "text-gray-400"}`} />
                    <div className="font-medium text-sm text-gray-900">AI Powered</div>
                    <div className="text-xs text-gray-500 mt-1">~1 minute</div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="space-y-1 text-center">
                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <FileType className="mx-auto h-12 w-12 text-blue-500" />
                        <span className="text-sm font-medium text-blue-600 mt-2">{selectedFile.name}</span>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label htmlFor="file-upload-modal" className="relative cursor-pointer font-medium text-blue-600 hover:text-blue-500">
                            <span>Upload a file</span>
                            <input
                              id="file-upload-modal"
                              type="file"
                              className="sr-only"
                              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setSelectedFile(file);
                              }}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PDF, Word, Excel, CSV up to 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Config */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Advanced Config (optional)
              <ChevronLeft className={`h-3 w-3 transition-transform ${showAdvanced ? "-rotate-90" : ""}`} />
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <textarea
                  value={advancedConfig}
                  onChange={(e) => {
                    setAdvancedConfig(e.target.value);
                    if (configError) setConfigError("");
                  }}
                  placeholder='{"max_pages": 50, "delay_ms": 500}'
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    configError ? "border-red-400 focus:ring-red-500" : "border-gray-300 focus:ring-orange-500"
                  }`}
                />
                {configError && <p className="text-xs text-red-600 mt-1">{configError}</p>}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : miningMode === "ai"
                    ? "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
              }`}
            >
              {loading ? (
                "Starting Job..."
              ) : (
                <>
                  {miningMode === "ai" && <Sparkles className="h-4 w-4" />}
                  Start Mining Job
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: JOBS
// ═══════════════════════════════════════════════════════════════════

function JobsTab({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MiningJobStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showNewJobModal, setShowNewJobModal] = useState(false);

  const { jobs, loading, error, totalCount, stats, refetch } = useMiningJobs(page, search, statusFilter);

  // Refetch when refreshKey changes (e.g. after creating job from Discover tab)
  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey]);

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      if (sortBy === "created_at") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      return sortOrder === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [jobs, sortBy, sortOrder]);

  const handleSelectAll = () => {
    setSelectedJobs(selectedJobs.length === sortedJobs.length ? [] : sortedJobs.map((j) => j.id));
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs((prev) => prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedJobs.length} jobs?`)) return;
    try {
      await Promise.all(selectedJobs.map((id) => fetch(`/api/mining/jobs/${id}`, { method: "DELETE", headers: getAuthHeaders() })));
      setSelectedJobs([]);
      refetch();
      toast.success(`${selectedJobs.length} jobs deleted`);
    } catch {
      toast.error("Error deleting jobs");
    }
  };

  const handleSingleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      const res = await fetch(`/api/mining/jobs/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      refetch();
      toast.success("Job deleted");
    } catch {
      toast.error("Error deleting job");
    }
  };

  const handleBulkExport = () => {
    const selectedData = sortedJobs.filter((j) => selectedJobs.includes(j.id));
    const csv = convertToCSV(selectedData);
    downloadCSV(csv, "mining-jobs-export.csv");
    toast.success("Jobs exported to CSV");
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleRemine = async (job: MiningJob) => {
    try {
      const response = await fetch("/api/mining/jobs", {
        method: "POST",
        headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "url",
          input: job.input,
          name: `${job.name} (retry)`,
          strategy: job.strategy || "auto",
          config: job.config || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create re-mine job");
      }

      toast.success("Re-mine job created!");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard title="Total Jobs" value={stats.total} icon={Database} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard title="Running" value={stats.running} icon={Activity} color="blue" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="red" />
        <StatCard title="Total Emails" value={stats.total_emails} icon={Mail} color="green" />
      </div>

      {/* Filters + New Job */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="needs_manual">Needs Manual</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refetch}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </button>
            <button
              onClick={() => setShowNewJobModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Job
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedJobs.length} job{selectedJobs.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button onClick={handleBulkExport} className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </button>
            <button onClick={handleBulkDelete} className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </button>
            <button onClick={() => setSelectedJobs([])} className="text-sm text-blue-600 hover:text-blue-800">
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-white">
        {loading && !jobs.length ? (
          <div className="p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
            ))}
          </div>
        ) : error && !jobs.length ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Error loading jobs: {error}</p>
            <button onClick={refetch} className="mt-4 text-sm text-orange-600 hover:text-orange-700">Try again</button>
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No mining jobs {statusFilter !== "all" ? `with status "${statusFilter}"` : "yet"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {statusFilter !== "all" ? "Try changing your filters or create a new job" : "Get started by creating your first mining job"}
            </p>
            <button
              onClick={() => setShowNewJobModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600"
            >
              Create Mining Job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length === sortedJobs.length && sortedJobs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("name")}>
                    Job Name <SortIcon field="name" />
                  </th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("status")}>
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-4 py-3 text-center">Progress</th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort("total_found")}>
                    Found <SortIcon field="total_found" />
                  </th>
                  <th className="px-4 py-3 text-right">Emails</th>
                  <th className="px-4 py-3 text-left">By</th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("created_at")}>
                    Created <SortIcon field="created_at" />
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <Link href={`/mining/jobs/${job.id}/results`} className="font-medium text-gray-900 hover:text-orange-600">
                          {job.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {job.site_profile && <span>Profile: {job.site_profile}</span>}
                          {job.parent_job_id && <span className="text-blue-600">Retry</span>}
                          {job.retry_job_id && <span className="text-green-600">Has retry</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 truncate max-w-[200px]">{job.input}</span>
                        <span className="text-xs text-gray-400">{job.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MinerStrategyCell job={job} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {job.status === "running" && job.progress ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-600">{job.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.total_found}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.total_emails_raw}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{job.creator_name || "&mdash;"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{new Date(job.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 items-center">
                        {job.status === "completed" && (
                          <Link href={`/mining/jobs/${job.id}/results`} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                            Results
                          </Link>
                        )}
                        {job.status === "failed" && (
                          <RetryJobButton jobId={job.id} jobName={job.name} onRetryComplete={refetch} />
                        )}
                        {job.type === "url" && (
                          <button
                            onClick={() => handleRemine(job)}
                            className="p-1 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Re-mine this URL"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleSingleDelete(job.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete Job"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
              <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, totalCount)}</span>{" "}
              of <span className="font-medium">{totalCount}</span> results
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Job Modal */}
      {showNewJobModal && (
        <NewJobModal onClose={() => setShowNewJobModal(false)} onJobCreated={refetch} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function LeadMiningPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <LeadMiningContent />
    </Suspense>
  );
}

function LeadMiningContent() {
  useAuthGuard();

  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "discover" ? "discover" : "jobs";
  const [activeTab, setActiveTab] = useState<"discover" | "jobs">(initialTab);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  const switchTab = (tab: "discover" | "jobs") => {
    setActiveTab(tab);
    const url = tab === "discover" ? "/mining?tab=discover" : "/mining?tab=jobs";
    router.replace(url, { scroll: false });
  };

  const handleMineCreated = () => {
    setJobsRefreshKey((k) => k + 1);
    switchTab("jobs");
    toast.success("Switched to Jobs tab");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Pickaxe className="h-6 w-6 text-orange-500" />
            Lead Mining
          </h1>
          <p className="text-sm text-gray-500">
            Discover data sources and manage extraction jobs
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-0 -mb-px">
          <button
            onClick={() => switchTab("discover")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "discover"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Search className="h-4 w-4 inline mr-2" />
            Discover
          </button>
          <button
            onClick={() => switchTab("jobs")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "jobs"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Database className="h-4 w-4 inline mr-2" />
            Jobs
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === "discover" ? (
          <DiscoverTab onMineCreated={handleMineCreated} />
        ) : (
          <JobsTab refreshKey={jobsRefreshKey} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((val) => (typeof val === "string" ? `"${val}"` : val))
      .join(",")
  );
  return [headers, ...rows].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
