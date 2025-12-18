"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Download,
  RefreshCw,
  Search,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Terminal,
  Activity,
  ChevronLeft,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Database,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

// Types matching backend schema
type MiningJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused";
type LogLevel = "debug" | "info" | "warn" | "error" | "success";

type JobDetail = {
  id: string;
  organizer_id: string;
  name: string;
  type: "url" | "file";
  input: string;
  strategy: "auto" | "playwright" | "http";
  site_profile?: string;
  status: MiningJobStatus;
  progress?: number; // 0-100
  total_found: number;
  total_emails_raw: number;
  total_prospects_created: number;
  processed_pages?: number;
  total_pages?: number;
  config?: {
    max_pages?: number;
    test_mode?: boolean;
    detail_url_pattern?: string;
  };
  stats?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
};

type LogEntry = {
  id?: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: any;
};

// Mock logs for development (şimdilik prod'da kullanmıyoruz, ama dursun)
const MOCK_LOGS: LogEntry[] = [
  { timestamp: new Date().toISOString(), level: "info", message: "⛏️ Mining Worker started" },
  { timestamp: new Date().toISOString(), level: "info", message: "📥 Mining job fetch: bd4fccb0-00e7-4992-a355-95189bb580c2" },
  { timestamp: new Date().toISOString(), level: "success", message: "✅ Job data loaded" },
  { timestamp: new Date().toISOString(), level: "info", message: "🌐 Launching browser for: https://exhibitors.big5constructnigeria.com/..." },
  { timestamp: new Date().toISOString(), level: "info", message: "📄 Loaded main list page" },
  { timestamp: new Date().toISOString(), level: "info", message: "📊 Total exhibitors detected: 172" },
  { timestamp: new Date().toISOString(), level: "info", message: "📖 Processing page 1 of 8" },
  { timestamp: new Date().toISOString(), level: "success", message: "✅ Page 1: found 24 exhibitors" },
  { timestamp: new Date().toISOString(), level: "info", message: "📖 Processing page 2 of 8" },
  { timestamp: new Date().toISOString(), level: "success", message: "✅ Page 2: found 24 exhibitors" },
  { timestamp: new Date().toISOString(), level: "warn", message: "⚠️ Rate limit approaching, slowing down..." },
  { timestamp: new Date().toISOString(), level: "info", message: "🔎 Visiting 172 exhibitor detail pages..." },
  { timestamp: new Date().toISOString(), level: "info", message: "➡️ [1/172] (0.6%) Visiting: MzYxMTQ=" },
  { timestamp: new Date().toISOString(), level: "success", message: "✅ ABUMET NIGERIA LIMITED" },
  { timestamp: new Date().toISOString(), level: "info", message: "📧 Emails: esther.duruibe@abumet.com" },
  { timestamp: new Date().toISOString(), level: "error", message: "❌ Error visiting exhibitor 60: Timeout 30000ms exceeded" },
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Components
function StatusBadge({ status }: { status: MiningJobStatus }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    paused: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const icons = {
    pending: <Clock className="h-3 w-3" />,
    running: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    paused: <Pause className="h-3 w-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function LogLevelBadge({ level }: { level: LogLevel }) {
  const styles = {
    debug: "text-gray-400",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    success: "text-green-400",
  };

  return (
    <span className={`font-medium ${styles[level]}`}>
      [{level.toUpperCase()}]
    </span>
  );
}

function StatCard({ label, value, icon: Icon, trend }: any) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {Number(value || 0).toLocaleString()}
          </p>
          {trend && (
            <p className="mt-1 text-xs text-green-600">+{trend} new</p>
          )}
        </div>
        <div className="rounded-lg bg-gray-100 p-2">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

export default function MiningJobConsolePage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;

  const jobId = useMemo(() => {
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId) && rawId.length > 0)
      return rawId[0] as string;
    return "";
  }, [rawId]);

  // State
  const [job, setJob] = useState<JobDetail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([
    "info",
    "warn",
    "error",
    "success",
  ]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [previousLogCount, setPreviousLogCount] = useState(0);

  // Calculate progress
  const progress = useMemo(() => {
    if (!job) return 0;

    if (job.progress !== undefined) return job.progress;

    if (job.total_pages && job.total_pages > 0 && job.processed_pages != null) {
      return Math.round((job.processed_pages / job.total_pages) * 100);
    }

    if (job.status === "completed") return 100;
    if (job.status === "pending") return 0;

    return 0;
  }, [job]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (
        !selectedLevels.includes(log.level) &&
        !(log.level === "debug" && showDebugLogs)
      ) {
        return false;
      }

      if (
        searchTerm &&
        !log.message.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [logs, selectedLevels, showDebugLogs, searchTerm]);

  // Fetch job details and logs
  const fetchData = useCallback(async () => {
    if (!jobId || !isValidUuid(jobId)) {
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const authHeaders = getAuthHeaders() ?? {};

      // Fetch job details
      const jobRes = await fetch(`/api/mining/jobs/${jobId}`, {
        headers: authHeaders,
      });
      if (!jobRes.ok) {
        throw new Error(`Failed to fetch job: ${jobRes.status}`);
      }
      const jobData = await jobRes.json();
      setJob(jobData.job || jobData);

      // Fetch logs
      const logsRes = await fetch(`/api/mining/jobs/${jobId}/logs`, {
        headers: authHeaders,
      });
      if (!logsRes.ok) {
        throw new Error(`Failed to fetch logs: ${logsRes.status}`);
      }

      const logsData = await logsRes.json();
      const entries: LogEntry[] = Array.isArray(logsData)
        ? logsData
        : logsData.logs || [];

      setLogs(entries);

      // Check for new logs
      if (entries.length > previousLogCount) {
        setPreviousLogCount(entries.length);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [jobId, previousLogCount]);

  // Initial fetch and polling
  useEffect(() => {
    if (!jobId || !isValidUuid(jobId)) {
      setLoading(false);
      return;
    }

    fetchData();

    // Poll every 2 seconds if job is running
    const interval = setInterval(() => {
      if (job?.status === "running" || job?.status === "pending") {
        fetchData();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchData, job?.status, jobId]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) return;
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filteredLogs, autoScroll]);

  // (Future) WebSocket
  useEffect(() => {
    // WebSocket entegrasyonu ileride
  }, [jobId]);

  // Actions
  const handlePause = async () => {
    try {
      await fetch(`/api/mining/jobs/${jobId}/pause`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      fetchData();
    } catch (err) {
      console.error("Error pausing job:", err);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/mining/jobs/${jobId}/resume`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      fetchData();
    } catch (err) {
      console.error("Error resuming job:", err);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this job?")) return;
    try {
      await fetch(`/api/mining/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      fetchData();
    } catch (err) {
      console.error("Error cancelling job:", err);
    }
  };

  const handleExportLogs = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${
            log.message
          }`
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId || "unknown"}-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLogsToClipboard = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${
            log.message
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(content);
  };

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  // Invalid / missing jobId → early UI
  if (!jobId || !isValidUuid(jobId)) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mining/jobs")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">Mining Job Console</h1>
            <p className="text-sm text-gray-500">
              Invalid or missing job ID in URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render
  if (loading && !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-4 ${
        isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mining/jobs")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">Mining Job Console</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                {job?.name || `Job ${jobId}`}
              </span>
              {job && <StatusBadge status={job.status} />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Job Actions */}
          {job?.status === "running" && (
            <button
              onClick={handlePause}
              className="inline-flex items-center px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </button>
          )}
          {job?.status === "paused" && (
            <button
              onClick={handleResume}
              className="inline-flex items-center px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
            >
              <Play className="h-4 w-4 mr-1" />
              Resume
            </button>
          )}
          {(job?.status === "running" ||
            job?.status === "paused") && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
            >
              <Square className="h-4 w-4 mr-1" />
              Cancel
            </button>
          )}
          {job?.status === "completed" && (
            <button
              onClick={() =>
                router.push(`/mining/jobs/${jobId}/results`)
              }
              className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600"
            >
              <Eye className="h-4 w-4 mr-1" />
              View Results
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="inline h-4 w-4 mr-1" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-gray-500">
                {progress}% • {job?.processed_pages || 0}/
                {job?.total_pages || "?"} pages
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {job?.config?.test_mode && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Test mode - Processing only first page
              </p>
            )}
          </div>
        </div>

        <StatCard
          label="Total Found"
          value={job?.total_found || 0}
          icon={Database}
          trend={job?.status === "running" ? "+12" : null}
        />
        <StatCard
          label="With Emails"
          value={job?.total_emails_raw || 0}
          icon={Activity}
        />
        <StatCard
          label="Prospects"
          value={job?.total_prospects_created || 0}
          icon={CheckCircle}
        />
      </div>

      {/* Job Details */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-medium mb-3">Job Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Strategy:</span>
            <span className="ml-2 font-medium">{job?.strategy}</span>
          </div>
          <div>
            <span className="text-gray-500">Profile:</span>
            <span className="ml-2 font-medium">
              {job?.site_profile || "auto"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Max Pages:</span>
            <span className="ml-2 font-medium">
              {job?.config?.max_pages || "∞"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Started:</span>
            <span className="ml-2 font-medium">
              {job?.started_at
                ? new Date(job.started_at).toLocaleTimeString()
                : "—"}
            </span>
          </div>
        </div>
        {job?.input && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-sm text-gray-500">Target URL:</span>
            <a
              href={job.input}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-sm text-blue-600 hover:underline"
            >
              {job.input}
            </a>
          </div>
        )}
      </div>

      {/* Console */}
      <div className="flex-1 rounded-lg border bg-black">
        {/* Console Header */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 py-2">
          <div className="flex items-center gap-3">
            <Terminal className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-300">
              Live Console
            </span>
            <span className="text-xs text-gray-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs bg-gray-800 text-gray-200 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
              />
            </div>

            {/* Level Filters */}
            <div className="flex items-center gap-1">
              {(["info", "warn", "error", "success"] as LogLevel[]).map(
                (level) => (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={`px-2 py-0.5 text-xs rounded ${
                      selectedLevels.includes(level)
                        ? "bg-gray-700 text-gray-200"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {level}
                  </button>
                )
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
              <button
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                title="Toggle debug logs"
                className="p-1 hover:bg-gray-800 rounded"
              >
                {showDebugLogs ? (
                  <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                title="Toggle auto-scroll"
                className={`p-1 hover:bg-gray-800 rounded ${
                  autoScroll ? "text-orange-400" : "text-gray-400"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={copyLogsToClipboard}
                title="Copy logs"
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Copy className="h-3.5 w-3.5 text-gray-400" />
              </button>
              <button
                onClick={handleExportLogs}
                title="Export logs"
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Download className="h-3.5 w-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                title="Toggle fullscreen"
                className="p-1 hover:bg-gray-800 rounded"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Console Body */}
        <div
          ref={logContainerRef}
          className="h-[500px] overflow-auto bg-black p-4 font-mono text-xs leading-relaxed"
          style={{
            maxHeight: isFullscreen ? "calc(100vh - 250px)" : "500px",
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500">
              {searchTerm
                ? "No logs matching your search"
                : "Waiting for logs..."}
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const levelColors: Record<LogLevel, string> = {
                debug: "text-gray-500",
                info: "text-gray-300",
                warn: "text-yellow-400",
                error: "text-red-400",
                success: "text-green-400",
              };

              return (
                <div
                  key={idx}
                  className="group hover:bg-gray-900/50 px-2 -mx-2 py-0.5"
                >
                  <span className="text-gray-600">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{" "}
                  <LogLevelBadge level={log.level} />{" "}
                  <span className={levelColors[log.level]}>
                    {log.message}
                  </span>
                  {log.details && (
                    <div className="ml-20 text-gray-600">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Console Footer */}
        <div className="border-t border-gray-800 bg-gray-900 px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Showing {filteredLogs.length} of {logs.length} logs
          </span>
          {job?.status === "running" && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
