"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  History,
  Shield,
  ShieldAlert,
  ShieldCheck,
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
  mining_status?: string | null;
  mining_found?: number;
  mining_job_id?: string;
  mined_at?: string | null;
}

interface DuplicateInfo {
  url: string;
  job_id: string;
  status: string;
  total_found: number;
  mined_at: string;
}

// ── CSV Export utility ──
function exportSourcesCsv(sources: Source[], filenameParts: string[]) {
  const header = "URL,Source Type,Notes,Estimated Companies,Mining Status,Mined Date";
  const rows = sources.map((s) => {
    const miningStatus = s.mining_status === "completed"
      ? `Mined — ${s.mining_found ?? 0} found`
      : s.mining_status === "running" ? "Mining..."
      : s.mining_status === "pending" ? "Pending"
      : s.mining_status === "failed" ? "Failed"
      : "Not mined";
    const minedDate = s.mined_at ? new Date(s.mined_at).toLocaleDateString("en-US") : "";
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    return [esc(s.url), esc(s.source_type), esc(s.notes || ""), s.estimated_companies || 0, esc(miningStatus), esc(minedDate)].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const parts = filenameParts.filter(Boolean).map(p => p.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()).join("-");
  a.download = `liffy-discovery-${parts}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Search loading messages ──
const SEARCH_MESSAGES = [
  "Searching the web for sources...",
  "Analyzing industry directories...",
  "Finding company listings...",
  "Checking member directories...",
  "Verifying source quality...",
  "Almost there...",
];

interface DiscoverySearch {
  id: string;
  source_type: string;
  keyword: string | null;
  industry: string | null;
  countries: string[] | null;
  result_count: number;
  results: Source[];
  created_at: string;
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

// Main source types (always visible)
const MAIN_SOURCE_TYPES: SourceTypeCard[] = [
  { id: "trade_fair", label: "Trade Fair", description: "Exhibitor directories", icon: Factory, placeholder: "e.g. Mega Clima Ghana 2025" },
  { id: "association", label: "Association", description: "Member directories", icon: Building2, placeholder: "e.g. HVAC manufacturers association" },
  { id: "business_directory", label: "Directory", description: "Kompass, Europages, portals", icon: BookOpen, placeholder: "e.g. packaging suppliers Germany" },
  { id: "company_listing", label: "Catalog / Listing", description: "WordPress, blogs, any page", icon: ScrollText, placeholder: "e.g. textile manufacturers catalog" },
  { id: "custom_url", label: "Paste URL", description: "Direct URL input", icon: Link2, placeholder: "https://example.com/members" },
];

// Extra source types (shown on expand)
const EXTRA_SOURCE_TYPES: SourceTypeCard[] = [
  { id: "chamber", label: "Chamber of Commerce", description: "Commerce members", icon: Landmark, placeholder: "e.g. Istanbul chamber of commerce" },
  { id: "trade_portal", label: "Trade Portal", description: "Supplier databases", icon: Globe, placeholder: "e.g. food exporters Turkey" },
  { id: "government_trade", label: "Gov Database", description: "Trade ministries", icon: Landmark, placeholder: "e.g. TOBB exporter list" },
  { id: "custom_search", label: "Custom Search", description: "Free keyword search", icon: Search, placeholder: "Type any search query..." },
];

const DISCOVERY_SOURCE_TYPES: SourceTypeCard[] = [...MAIN_SOURCE_TYPES, ...EXTRA_SOURCE_TYPES];

const INDUSTRY_OPTIONS = [
  "Agriculture & Agribusiness",
  "Automotive & Auto Parts",
  "Beauty & Cosmetics",
  "Chemicals & Petrochemicals",
  "Construction & Building Materials",
  "Defense & Security",
  "Electronics & Electrical",
  "Energy & Renewable Energy",
  "Food & Beverage",
  "Furniture & Home Décor",
  "Healthcare & Medical Devices",
  "HVAC & Refrigeration",
  "IT & Telecommunications",
  "Logistics & Transport",
  "Machinery & Industrial Equipment",
  "Mining & Metals",
  "Packaging",
  "Plastics & Rubber",
  "Printing & Paper",
  "Security & Safety",
  "Textiles & Apparel",
  "Tourism & Hospitality",
  "Water & Environment",
  "Other",
];

const POPULAR_COUNTRIES = [
  "Turkey", "Germany", "France", "Italy", "Nigeria", "Ghana", "Morocco", "USA", "UK", "UAE",
];

const COUNTRY_OPTIONS = [
  // Africa
  "Algeria", "Angola", "Cameroon", "Egypt", "Ethiopia", "Ghana", "Ivory Coast",
  "Kenya", "Libya", "Morocco", "Mozambique", "Nigeria", "Rwanda", "Senegal",
  "South Africa", "Tanzania", "Tunisia", "Uganda", "Zimbabwe",
  // Americas
  "Argentina", "Brazil", "Canada", "Chile", "Colombia", "Mexico", "Peru", "USA",
  // Asia
  "Bangladesh", "China", "India", "Indonesia", "Iran", "Japan", "Kazakhstan",
  "Malaysia", "Pakistan", "Philippines", "Singapore", "South Korea", "Sri Lanka",
  "Thailand", "Uzbekistan", "Vietnam",
  // Europe
  "Austria", "Belgium", "Bulgaria", "Croatia", "Czech Republic", "Denmark",
  "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia",
  "Spain", "Sweden", "Switzerland", "UK", "Ukraine",
  // Middle East
  "Bahrain", "Iraq", "Jordan", "Kuwait", "Lebanon", "Oman", "Qatar",
  "Saudi Arabia", "Turkey", "UAE",
  // Oceania
  "Australia", "New Zealand",
].filter((c, i, a) => a.indexOf(c) === i).sort(); // dedupe + sort

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
// MINEABILITY PRE-CHECK
// ═══════════════════════════════════════════════════════════════════

interface AnalysisResult {
  mineability: "high" | "medium" | "low";
  score: number;
  checks: {
    reachable: boolean;
    page_size_kb: number;
    email_count: number;
    table_count: number;
    link_count: number;
    has_exhibitor_pattern: boolean;
    js_heavy: boolean;
    login_required: boolean;
    blocked: boolean;
  };
  badges: string[];
  warnings: string[];
  suggested_miner: string;
  estimated_contacts: number;
}

async function analyzeUrlPreCheck(url: string): Promise<AnalysisResult | null> {
  try {
    const res = await fetch("/api/mining/analyze-url", {
      method: "POST",
      headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function PreCheckModal({
  analysis,
  url,
  onConfirm,
  onCancel,
}: {
  analysis: AnalysisResult;
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isLow = analysis.mineability === "low";
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 ${isLow ? "bg-red-50 border-b border-red-100" : "bg-yellow-50 border-b border-yellow-100"}`}>
          <div className="flex items-center gap-3">
            {isLow ? (
              <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0" />
            ) : (
              <Shield className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            )}
            <div>
              <h3 className={`font-semibold ${isLow ? "text-red-800" : "text-yellow-800"}`}>
                {isLow ? "Low confidence — mining may not produce results" : "Medium confidence for this URL"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{hostname}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-12">Score</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  analysis.score >= 60 ? "bg-green-500" : analysis.score >= 30 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${analysis.score}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 w-8 text-right">{analysis.score}</span>
          </div>

          {/* Badges (positive findings) */}
          {analysis.badges.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Found on page</p>
              <ul className="space-y-1">
                {analysis.badges.map((b, i) => (
                  <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Issues detected</p>
              <ul className="space-y-1">
                {analysis.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Estimated contacts */}
          {analysis.estimated_contacts > 0 && (
            <p className="text-xs text-gray-600">
              Estimated contacts: <span className="font-semibold">~{analysis.estimated_contacts}</span>
            </p>
          )}

          {/* Suggested miner */}
          <p className="text-xs text-gray-400">
            Suggested: {analysis.suggested_miner}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              isLow
                ? "bg-red-500 hover:bg-red-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Pickaxe className="w-3.5 h-3.5" />
              Mine Anyway
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

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

function DiscoverTab({ onMineCreated, onViewHistory }: { onMineCreated: () => void; onViewHistory: () => void }) {
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

  // Rate limit state
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Selection state
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // Pre-check state
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null);
  const [preCheckResult, setPreCheckResult] = useState<{ analysis: AnalysisResult; source: Source } | null>(null);

  // Duplicate confirmation state
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ source: Source } | null>(null);
  const [batchDuplicateConfirm, setBatchDuplicateConfirm] = useState<{
    duplicates: DuplicateInfo[];
    newUrls: string[];
  } | null>(null);

  // Search abort + loading message
  const abortRef = useRef<AbortController | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

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
    setLoadingMsg(SEARCH_MESSAGES[0]);

    // Cycle loading messages every 5s
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % SEARCH_MESSAGES.length;
      setLoadingMsg(SEARCH_MESSAGES[msgIdx]);
    }, 5000);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
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

      // Rate limit handling
      if (data.error === "rate_limit") {
        const wait = data.retry_after || 60;
        setRateLimitCountdown(wait);
        toast.error(`AI search rate limited. Please wait ${wait}s and try again.`);
        return;
      }

      setSources(data.sources || []);
      setSearchedAt(data.searched_at || new Date().toISOString());

      if (data.sources?.length > 0) {
        toast.success(`Found ${data.sources.length} sources`);
      } else {
        toast("No sources found. Try different search terms.", { icon: "🔍" });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Search cancelled or timed out.");
      } else {
        toast.error(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
      setLoadingMsg("");
      abortRef.current = null;
    }
  };

  const handleCancelSearch = () => {
    abortRef.current?.abort();
  };

  const createMiningJob = async (source: Source) => {
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
      const hostname = (() => { try { return new URL(source.url).hostname; } catch { return source.url; } })();
      toast.success(`Mining started for ${hostname}`);
      onMineCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create mining job");
    }
  };

  const handleMine = async (source: Source, force = false) => {
    // Check if already mined (from prior_mining data) — show confirmation
    if (!force && source.mining_status && ['completed', 'running', 'pending'].includes(source.mining_status)) {
      setDuplicateConfirm({ source });
      return;
    }

    setAnalyzingUrl(source.url);
    const analysis = await analyzeUrlPreCheck(source.url);
    setAnalyzingUrl(null);

    if (!analysis) {
      // Analysis failed — proceed directly
      await createMiningJob(source);
      return;
    }

    if (analysis.mineability === "high") {
      const emailMsg = analysis.checks.email_count > 0 ? ` — ${analysis.checks.email_count} emails detected` : "";
      toast.success(`High confidence${emailMsg}`, { duration: 3000 });
      await createMiningJob(source);
    } else {
      // Show modal for medium/low
      setPreCheckResult({ analysis, source });
    }
  };

  const handleMineSelected = async (force = false) => {
    if (selectedUrls.size === 0) return;
    setBatchLoading(true);
    try {
      const urls = Array.from(selectedUrls).map((url) => ({ url }));
      const res = await fetch("/api/mining/batch-create", {
        method: "POST",
        headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
        body: JSON.stringify({ urls, force }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mining jobs");
      }
      const data = await res.json();

      // Handle duplicates — show confirmation modal
      if (data.duplicates?.length > 0 && !force) {
        const newUrls = (data.jobs || []).map((j: { input: string }) => j.input);
        setBatchDuplicateConfirm({ duplicates: data.duplicates, newUrls });
        if (data.created > 0) {
          toast.success(`${data.created} new mining jobs created`);
        }
        setSelectedUrls(new Set());
        onMineCreated();
        setBatchLoading(false);
        return;
      }

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

  // "More options" expand state
  const [showExtraTypes, setShowExtraTypes] = useState(false);

  return (
    <div>
      {/* ── Source Type Selection — 5 main + "More options" expandable ── */}
      <div className="mb-4">
        {!selectedSourceType ? (
          <>
            <p className="text-sm text-gray-500 mb-3">Select a source type to start discovering</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {MAIN_SOURCE_TYPES.map((st) => {
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
            {/* More options toggle */}
            {!showExtraTypes ? (
              <button
                type="button"
                onClick={() => setShowExtraTypes(true)}
                className="mt-2 text-xs text-gray-400 hover:text-orange-600 inline-flex items-center gap-1"
              >
                <ChevronDown className="w-3 h-3" /> More options
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowExtraTypes(false)}
                  className="mt-2 text-xs text-gray-400 hover:text-orange-600 inline-flex items-center gap-1 mb-2"
                >
                  <ChevronUp className="w-3 h-3" /> Less options
                </button>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {EXTRA_SOURCE_TYPES.map((st) => {
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
            )}
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
                    {POPULAR_COUNTRIES.filter((c) => !selectedCountries.includes(c)).map((c) => (
                      <option key={`pop-${c}`} value={c}>{c}</option>
                    ))}
                    <option disabled>──────────</option>
                    {COUNTRY_OPTIONS.filter((c) => !selectedCountries.includes(c) && !POPULAR_COUNTRIES.includes(c)).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search button */}
              <button
                type="submit"
                disabled={loading || rateLimitCountdown > 0}
                className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-md transition-colors text-sm h-[38px]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Searching..." : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s` : "Discover"}
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
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-gray-500 animate-pulse">{loadingMsg || "Searching..."}</p>
              <button
                type="button"
                onClick={handleCancelSearch}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Cancel
              </button>
            </div>
          )}
          {rateLimitCountdown > 0 && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-700">
                Rate limited. Please wait <span className="font-semibold">{rateLimitCountdown}s</span> before searching again.
              </span>
            </div>
          )}
        </form>
      )}

      {/* ── Skeleton loading cards ── */}
      {loading && (
        <div className="space-y-2 mt-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 rounded bg-gray-200" />
                <div className="w-16 h-5 rounded bg-gray-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
                <div className="w-12 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-7 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
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
          <div className="flex items-center gap-3">
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => exportSourcesCsv(sources, [selectedSourceType || "discovery", industry, keyword])}
                className="text-xs text-gray-400 hover:text-orange-600 inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            )}
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

                  {/* Stats + Mine/Status */}
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                    <span className="text-gray-600 font-medium" title="Estimated companies">
                      {source.estimated_companies || "?"} co.
                    </span>
                    {source.mining_status === "completed" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Mined &mdash; {source.mining_found ?? 0} found
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMine(source); }}
                          className="text-[11px] text-gray-400 hover:text-orange-600 underline"
                        >
                          Mine Again
                        </button>
                      </div>
                    ) : source.mining_status === "running" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Mining...
                      </span>
                    ) : source.mining_status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : source.mining_status === "failed" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMine(source, true); }}
                          className="text-[11px] text-red-500 hover:text-red-700 underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : analyzingUrl === source.url ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMine(source); }}
                        disabled={!!analyzingUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-xs font-medium rounded transition-colors"
                      >
                        <Pickaxe className="w-3 h-3" />
                        Mine
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Saved link ── */}
      {searchedAt && sources.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          This search has been saved.{" "}
          <button type="button" onClick={onViewHistory} className="text-orange-500 hover:text-orange-600 underline">
            View in Search History &rarr;
          </button>
        </p>
      )}

      {/* ── Bottom bar: Mine Selected ── */}
      {sources.length > 0 && selectedUrls.size > 0 && (
        <div className="sticky bottom-0 mt-3 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-orange-600">{selectedUrls.size}</span> selected
          </span>
          <button
            type="button"
            onClick={() => handleMineSelected()}
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

      {/* ── Pre-check modal ── */}
      {preCheckResult && (
        <PreCheckModal
          analysis={preCheckResult.analysis}
          url={preCheckResult.source.url}
          onConfirm={async () => {
            const src = preCheckResult.source;
            setPreCheckResult(null);
            await createMiningJob(src);
          }}
          onCancel={() => setPreCheckResult(null)}
        />
      )}

      {/* ── Duplicate confirmation modal (single URL) ── */}
      {duplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDuplicateConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-yellow-50 border-b border-yellow-100">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Already Mined</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(() => { try { return new URL(duplicateConfirm.source.url).hostname; } catch { return duplicateConfirm.source.url; } })()}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700">
                This URL was already mined
                {duplicateConfirm.source.mining_found ? ` (${duplicateConfirm.source.mining_found} contacts found` : " ("}
                {duplicateConfirm.source.mined_at
                  ? ` on ${new Date(duplicateConfirm.source.mined_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : ""}
                ). Mine again?
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const src = duplicateConfirm.source;
                  setDuplicateConfirm(null);
                  await handleMine(src, true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors inline-flex items-center gap-1.5"
              >
                <Pickaxe className="w-3.5 h-3.5" />
                Mine Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch duplicate confirmation modal ── */}
      {batchDuplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBatchDuplicateConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-yellow-50 border-b border-yellow-100">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Some URLs Already Mined</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {batchDuplicateConfirm.duplicates.length} already mined
                    {batchDuplicateConfirm.newUrls.length > 0 ? `, ${batchDuplicateConfirm.newUrls.length} new jobs created` : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 max-h-60 overflow-y-auto">
              <p className="text-xs font-medium text-gray-500 mb-2">Previously mined URLs:</p>
              <div className="space-y-1.5">
                {batchDuplicateConfirm.duplicates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600 truncate flex-1">
                      {(() => { try { return new URL(d.url).hostname; } catch { return d.url; } })()}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">
                      {d.total_found} contacts &middot; {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchDuplicateConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
              >
                OK
              </button>
              <button
                type="button"
                onClick={async () => {
                  const dupUrls = batchDuplicateConfirm.duplicates.map(d => ({ url: d.url }));
                  setBatchDuplicateConfirm(null);
                  setBatchLoading(true);
                  try {
                    const res = await fetch("/api/mining/batch-create", {
                      method: "POST",
                      headers: { ...(getAuthHeaders() ?? {}), "Content-Type": "application/json" },
                      body: JSON.stringify({ urls: dupUrls, force: true }),
                    });
                    if (!res.ok) throw new Error("Failed to create mining jobs");
                    const data = await res.json();
                    toast.success(`${data.created} re-mine jobs created!`);
                    onMineCreated();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to re-mine");
                  } finally {
                    setBatchLoading(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors inline-flex items-center gap-1.5"
              >
                <Pickaxe className="w-3.5 h-3.5" />
                Re-mine All ({batchDuplicateConfirm.duplicates.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: SEARCH HISTORY
// ═══════════════════════════════════════════════════════════════════

function SearchHistoryTab({ onMineCreated }: { onMineCreated: () => void }) {
  const [searches, setSearches] = useState<DiscoverySearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null);
  const [preCheckResult, setPreCheckResult] = useState<{ analysis: AnalysisResult; source: Source } | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterKeyword, setFilterKeyword] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/source-discovery/history", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setSearches(data.searches || []);
    } catch {
      toast.error("Failed to load search history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => prev === id ? null : id);
    setSelectedUrls(new Set());
  };

  const toggleSource = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const createMiningJob = async (source: Source) => {
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
      toast.success("Mining job created!");
      onMineCreated();
      fetchHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create mining job");
    }
  };

  const handleMine = async (source: Source) => {
    setAnalyzingUrl(source.url);
    const analysis = await analyzeUrlPreCheck(source.url);
    setAnalyzingUrl(null);

    if (!analysis) {
      await createMiningJob(source);
      return;
    }

    if (analysis.mineability === "high") {
      const emailMsg = analysis.checks.email_count > 0 ? ` — ${analysis.checks.email_count} emails detected` : "";
      toast.success(`High confidence${emailMsg}`, { duration: 3000 });
      await createMiningJob(source);
    } else {
      setPreCheckResult({ analysis, source });
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
      fetchHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create mining jobs");
    } finally {
      setBatchLoading(false);
    }
  };

  // Source type label for search cards
  const sourceTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      trade_fair: "Trade Fair", association: "Association", chamber: "Chamber",
      business_directory: "Directory", company_listing: "Catalog", trade_portal: "Trade Portal",
      government_trade: "Gov DB", custom_search: "Custom", custom_url: "URL",
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (searches.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No searches yet</p>
        <p className="text-xs mt-1">Start discovering sources in the Discover tab.</p>
      </div>
    );
  }

  const hasFilters = filterType !== "all" || filterKeyword.trim().length > 0;
  const filteredSearches = searches.filter((s) => {
    if (filterType !== "all" && s.source_type !== filterType) return false;
    if (filterKeyword.trim()) {
      const q = filterKeyword.trim().toLowerCase();
      const haystack = [s.keyword, s.industry, ...(s.countries || [])].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="all">All Types</option>
          <option value="trade_fair">Trade Fair</option>
          <option value="association">Association</option>
          <option value="business_directory">Directory</option>
          <option value="company_listing">Catalog</option>
          <option value="chamber">Chamber</option>
          <option value="trade_portal">Trade Portal</option>
          <option value="government_trade">Gov DB</option>
          <option value="custom_search">Custom</option>
          <option value="custom_url">URL</option>
        </select>
        <input
          type="text"
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          placeholder="Search history..."
          className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs flex-1 min-w-[120px] max-w-[200px] focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        <span className="text-xs text-gray-400">
          Showing {filteredSearches.length} of {searches.length}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilterType("all"); setFilterKeyword(""); }}
            className="text-xs text-orange-500 hover:text-orange-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredSearches.map((s) => {
        const isExpanded = expandedId === s.id;
        // Build search description
        const descParts = [s.keyword, s.industry, ...(s.countries || [])].filter(Boolean);
        const description = descParts.join(" | ") || "No filters";
        const unminedCount = s.results.filter((r) => !r.mining_status).length;

        return (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Search card header */}
            <button
              type="button"
              onClick={() => toggleExpand(s.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-orange-100 text-orange-700 flex-shrink-0">
                {sourceTypeLabel(s.source_type)}
              </span>
              <span className="text-sm text-gray-700 font-medium truncate flex-1">{description}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {s.result_count} source{s.result_count !== 1 ? "s" : ""}
              </span>
              {unminedCount > 0 && unminedCount < s.result_count && (
                <span className="text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 flex-shrink-0">
                  {unminedCount} unmined
                </span>
              )}
              <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
                {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                {new Date(s.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {/* Expanded results */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                {s.results.length > 0 && (
                  <div className="flex items-center justify-end mb-2">
                    <button
                      type="button"
                      onClick={() => exportSourcesCsv(s.results, [s.source_type, s.keyword || "", s.industry || ""])}
                      className="text-xs text-gray-400 hover:text-orange-600 inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Export CSV
                    </button>
                  </div>
                )}
                {s.results.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No results in this search.</p>
                ) : (
                  <div className="space-y-1.5">
                    {s.results.map((source, idx) => {
                      const typeConfig = SOURCE_TYPE_CONFIG[source.source_type] || SOURCE_TYPE_CONFIG.other;
                      const TypeIcon = typeConfig.icon;
                      let hostname = "";
                      try { hostname = new URL(source.url).hostname; } catch { hostname = source.url; }
                      const isMined = !!source.mining_status;
                      const isSelected = selectedUrls.has(source.url);

                      return (
                        <div
                          key={idx}
                          className={`bg-white border rounded-lg px-3 py-2 transition-all ${
                            isMined ? "border-gray-200 opacity-80" : isSelected ? "border-orange-400 bg-orange-50/30 cursor-pointer" : "border-gray-200 hover:border-gray-300 cursor-pointer"
                          }`}
                          onClick={() => !isMined && toggleSource(source.url)}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox — only for unmined */}
                            {!isMined ? (
                              <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                              }`}>
                                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-4 h-4" />
                            )}

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

                            {/* Mining status or Mine button */}
                            <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                              <span className="text-gray-600 font-medium" title="Estimated companies">
                                {source.estimated_companies || "?"} co.
                              </span>
                              {source.mining_status === "completed" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" />
                                  Mined &mdash; {source.mining_found ?? 0} found
                                </span>
                              ) : source.mining_status === "running" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Mining...
                                </span>
                              ) : source.mining_status === "failed" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                                  <XCircle className="w-3 h-3" />
                                  Failed
                                </span>
                              ) : analyzingUrl === source.url ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Analyzing...
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMine(source); }}
                                  disabled={!!analyzingUrl}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-xs font-medium rounded transition-colors"
                                >
                                  <Pickaxe className="w-3 h-3" />
                                  Mine
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Batch mine bar for this search */}
                {selectedUrls.size > 0 && (
                  <div className="mt-3 flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <span className="text-sm text-gray-600">
                      <span className="font-semibold text-orange-600">{selectedUrls.size}</span> selected
                    </span>
                    <button
                      type="button"
                      onClick={handleMineSelected}
                      disabled={batchLoading}
                      className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-md transition-colors text-sm"
                    >
                      {batchLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                      ) : (
                        <><Pickaxe className="w-4 h-4" /> Mine Selected ({selectedUrls.size})</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Pre-check modal ── */}
      {preCheckResult && (
        <PreCheckModal
          analysis={preCheckResult.analysis}
          url={preCheckResult.source.url}
          onConfirm={async () => {
            const src = preCheckResult.source;
            setPreCheckResult(null);
            await createMiningJob(src);
          }}
          onCancel={() => setPreCheckResult(null)}
        />
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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
        const token = (authHeaders as Record<string, string>)?.["Authorization"] || "";

        // Use XMLHttpRequest for upload progress tracking
        const data = await new Promise<{ success?: boolean; error?: string; details?: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/mining/jobs");
          if (token) xhr.setRequestHeader("Authorization", token);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            setUploadProgress(null);
            try {
              const json = JSON.parse(xhr.responseText);
              if (xhr.status >= 400) {
                reject(new Error(json.error || json.details || `Upload failed (HTTP ${xhr.status})`));
              } else {
                resolve(json);
              }
            } catch {
              reject(new Error(`Upload failed (HTTP ${xhr.status})`));
            }
          };

          xhr.onerror = () => {
            setUploadProgress(null);
            reject(new Error("Upload failed — connection error or timeout"));
          };

          xhr.ontimeout = () => {
            setUploadProgress(null);
            reject(new Error("Upload timed out — file may be too large for cloud upload"));
          };

          xhr.timeout = 600000; // 10 min timeout for large files
          xhr.send(formData);
        });

        if (data.error) {
          throw new Error(data.error);
        }

        toast.success("Mining job started successfully!");
        onJobCreated();
        onClose();
        return;
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
                        {selectedFile.size > 100 * 1024 * 1024 && (
                          <p className="text-xs text-amber-600 mt-1 font-medium">
                            Large file — upload may take a few minutes
                          </p>
                        )}
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
                        <p className="text-xs text-gray-500">PDF, Word, Excel, CSV up to 1GB</p>
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
              {loading && uploadProgress !== null ? (
                `Uploading... ${uploadProgress}%`
              ) : loading ? (
                "Starting Job..."
              ) : (
                <>
                  {miningMode === "ai" && <Sparkles className="h-4 w-4" />}
                  Start Mining Job
                </>
              )}
            </button>
            {uploadProgress !== null && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
                  {selectedFile && ` (${(selectedFile.size / 1024 / 1024).toFixed(0)} MB)`}
                </p>
              </div>
            )}
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
                    Contacts <SortIcon field="total_found" />
                  </th>
                  <th className="px-4 py-3 text-right">Raw</th>
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
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.status === "completed" && job.total_found === 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">No results</span>
                        )}
                        {job.status === "completed" && job.total_found > 0 && job.total_found <= 3 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Low</span>
                        )}
                        {job.status === "completed" && job.total_found > 50 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Good</span>
                        )}
                        {job.stats?.single_domain_warning && (
                          <span title={`${job.stats.domain_percentage}% from ${job.stats.dominant_domain}`}>
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                          </span>
                        )}
                        <span>{job.total_found}</span>
                      </div>
                    </td>
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
  type TabType = "discover" | "history" | "jobs";
  const tabParam = searchParams.get("tab");
  const initialTab: TabType = tabParam === "discover" ? "discover" : tabParam === "history" ? "history" : "jobs";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/mining?tab=${tab}`, { scroll: false });
  };

  const handleMineCreated = () => {
    setJobsRefreshKey((k) => k + 1);
    setHistoryRefreshKey((k) => k + 1);
    switchTab("jobs");
    toast.success("Switched to Jobs tab");
  };

  const handleViewHistory = () => {
    setHistoryRefreshKey((k) => k + 1);
    switchTab("history");
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
            onClick={() => switchTab("history")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <History className="h-4 w-4 inline mr-2" />
            Search History
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
          <DiscoverTab onMineCreated={handleMineCreated} onViewHistory={handleViewHistory} />
        ) : activeTab === "history" ? (
          <SearchHistoryTab key={historyRefreshKey} onMineCreated={handleMineCreated} />
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
