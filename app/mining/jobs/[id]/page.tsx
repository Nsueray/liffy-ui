"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Database,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  FileText,
  Terminal,
  Copy,
  Edit2,
  Save,
  X,
  Trash2,
  Calendar,
  Timer,
  Globe,
  Settings,
  Code,
  Users,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  PauseCircle,
  StopCircle
} from "lucide-react";

type MiningJobStatus = "pending" | "running" | "completed" | "failed" | "paused";
type Strategy = "auto" | "playwright" | "http";

type MiningJobDetail = {
  id: string;
  organizer_id: string;
  name: string;
  type: "url" | "file";
  input: string;
  strategy: Strategy;
  site_profile?: string;
  status: MiningJobStatus;
  progress?: number;
  total_found: number;
  total_emails_raw: number;
  total_prospects_created: number;
  processed_pages?: number;
  total_pages?: number;
  config?: {
    max_pages?: number;
    force_page_count?: number;
    detail_url_pattern?: string;
    list_page_delay_ms?: number;
    detail_delay_ms?: number;
    test_mode?: boolean;
  };
  stats?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
  parent_job_id?: string;
  retry_job_id?: string;
  notes?: string | null;
};

type PageProps = {
  params: {
    id: string;
  };
};

// Utility functions
function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(start?: string, end?: string) {
  if (!start) return "—";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diff = endDate.getTime() - startDate.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function StatusBadge({ status }: { status: MiningJobStatus }) {
  const styles: Record<MiningJobStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    paused: "bg-gray-100 text-gray-800 border-gray-200"
  };

  const icons: Record<MiningJobStatus, JSX.Element> = {
    pending: <Clock className="h-3 w-3" />,
    running: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    paused: <PauseCircle className="h-3 w-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "gray",
  trend
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: "blue" | "green" | "yellow" | "red" | "gray";
  trend?: number;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200"
  };

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        )}
        {trend !== undefined && (
          <p className={`mt-1 text-xs ${trend > 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {trend > 0 ? `+${trend}` : trend} new
          </p>
        )}
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClasses[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

// Mock data builder
function buildMockJob(jobId: string): MiningJobDetail {
  if (jobId === "bd4fccb0-00e7-4992-a355-95189bb580c2") {
    return {
      id: jobId,
      organizer_id: "org_1",
      name: "Big5 Nigeria Exhibitors",
      type: "url",
      input: "https://exhibitors.big5constructnigeria.com/the-big-5-construct-nigeria-2025/Exhibitor",
      strategy: "playwright",
      site_profile: "big5",
      status: "completed",
      progress: 100,
      total_found: 172,
      total_emails_raw: 173,
      total_prospects_created: 168,
      processed_pages: 172,
      total_pages: 172,
      config: {
        max_pages: 20,
        force_page_count: 8,
        detail_url_pattern: "/Exhibitor/ExbDetails/",
        list_page_delay_ms: 2000,
        detail_delay_ms: 800,
        test_mode: false
      },
      created_at: "2025-11-24T10:00:00Z",
      started_at: "2025-11-24T10:00:10Z",
      completed_at: "2025-11-24T10:09:42Z",
      updated_at: "2025-11-24T10:09:42Z",
      notes: "Successfully scraped all exhibitors from Big5 Nigeria 2025. Used force_page_count=8 to handle pagination."
    };
  }

  return {
    id: jobId,
    organizer_id: "org_1",
    name: `Mining Job ${jobId.slice(0, 8)}`,
    type: "url",
    input: "https://example.com",
    strategy: "playwright",
    status: "running",
    progress: 45,
    total_found: 89,
    total_emails_raw: 67,
    total_prospects_created: 0,
    processed_pages: 45,
    total_pages: 100,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export default function MiningJobDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const jobId = params.id;

  const [job, setJob] = useState<MiningJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mining/jobs/${jobId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn("API not available, using mock data");
        const mockJob = buildMockJob(jobId);
        setJob(mockJob);
        setNotesValue(mockJob.notes || "");
      } else {
        const data = await res.json();
        const jobData = data.job || data;
        setJob(jobData);
        setNotesValue(jobData.notes || "");
      }
    } catch (err: any) {
      console.warn("Using mock data:", err);
      const mockJob = buildMockJob(jobId);
      setJob(mockJob);
      setNotesValue(mockJob.notes || "");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    // Auto-refresh for running jobs
    const interval = setInterval(() => {
      if (job?.status === "running") {
        fetchJob();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJob, job?.status]);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveNotes = async () => {
    try {
      await fetch(`/api/mining/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue })
      });
      if (job) {
        setJob({ ...job, notes: notesValue });
      }
      setEditingNotes(false);
    } catch (err) {
      console.error("Failed to save notes:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;
    
    setDeleting(true);
    try {
      await fetch(`/api/mining/jobs/${jobId}`, { method: "DELETE" });
      router.push("/mining/jobs");
    } catch (err) {
      console.error("Failed to delete job:", err);
      setDeleting(false);
    }
  };

  const handleRetry = async () => {
    try {
      const res = await fetch(`/api/mining/jobs/${jobId}/retry`, { method: "POST" });
      const data = await res.json();
      router.push(`/mining/jobs/${data.new_job_id}/console`);
    } catch (err) {
      console.error("Failed to retry job:", err);
    }
  };

  const handlePause = async () => {
    try {
      await fetch(`/api/mining/jobs/${jobId}/pause`, { method: "POST" });
      fetchJob();
    } catch (err) {
      console.error("Failed to pause job:", err);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/mining/jobs/${jobId}/resume`, { method: "POST" });
      fetchJob();
    } catch (err) {
      console.error("Failed to resume job:", err);
    }
  };

  const handleStop = async () => {
    if (!confirm("Stop this job? You can retry it later.")) return;
    try {
      await fetch(`/api/mining/jobs/${jobId}/cancel`, { method: "POST" });
      fetchJob();
    } catch (err) {
      console.error("Failed to stop job:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Job not found</p>
        </div>
      </div>
    );
  }

  const duration = formatDuration(job.started_at, job.completed_at);
  const progressPercent = job.progress || (job.status === "completed" ? 100 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/mining/jobs"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Jobs
          </Link>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Job ID:</span>
            <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
              {job.id.slice(0, 8)}...
            </code>
            <button
              onClick={handleCopyId}
              className="p-1 hover:bg-gray-100 rounded"
              title="Copy full ID"
            >
              {copiedId ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <span className="text-xs text-gray-500">
            Updated {new Date(job.updated_at).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Title & Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{job.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete overview and configuration details for this mining job
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {job.status === "running" && (
            <>
              <button
                onClick={handlePause}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
              >
                <PauseCircle className="h-4 w-4 inline mr-1" />
                Pause
              </button>
              <button
                onClick={handleStop}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
              >
                <StopCircle className="h-4 w-4 inline mr-1" />
                Stop
              </button>
            </>
          )}
          {job.status === "paused" && (
            <button
              onClick={handleResume}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
            >
              <PlayCircle className="h-4 w-4 inline mr-1" />
              Resume
            </button>
          )}
          {(job.status === "failed" || job.status === "completed") && (
            <button
              onClick={handleRetry}
              className="px-3 py-1.5 text-sm text-orange-600 border border-orange-200 rounded-md hover:bg-orange-50"
            >
              <RefreshCw className="h-4 w-4 inline mr-1" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {job.status === "running" && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-500">
              {progressPercent}% • {job.processed_pages || 0}/{job.total_pages || "?"} pages
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>Started: {new Date(job.started_at!).toLocaleTimeString()}</span>
            <span>Duration: {duration}</span>
            <span>ETA: {progressPercent > 0 ? `~${Math.round((100 - progressPercent) * 0.1)} min` : "Calculating..."}</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {job.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Job Error</p>
              <p className="mt-1 text-sm text-red-700">{job.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Found"
          value={job.total_found}
          subtitle={`From ${job.processed_pages || 0} pages`}
          icon={Database}
          color="blue"
          trend={job.status === "running" ? 12 : undefined}
        />
        <StatCard
          title="Emails Extracted"
          value={job.total_emails_raw}
          subtitle={`${((job.total_emails_raw / Math.max(job.total_found, 1)) * 100).toFixed(0)}% coverage`}
          icon={Mail}
          color="green"
        />
        <StatCard
          title="Prospects Created"
          value={job.total_prospects_created}
          subtitle="Ready to import"
          icon={Users}
          color="yellow"
        />
        <StatCard
          title="Duration"
          value={duration}
          subtitle={job.status === "running" ? "Still running" : "Total time"}
          icon={Timer}
          color="gray"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Configuration */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-sm font-medium mb-4">Job Configuration</h2>
            
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Type</dt>
                <dd className="mt-1 text-sm font-medium">
                  {job.type === "url" ? "URL" : "File"}
                </dd>
              </div>
              
              <div>
                <dt className="text-xs text-gray-500">Strategy</dt>
                <dd className="mt-1 text-sm font-medium capitalize">
                  {job.strategy}
                </dd>
              </div>
              
              <div className="col-span-2">
                <dt className="text-xs text-gray-500">Target URL</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <a
                    href={job.input}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate"
                  >
                    {job.input}
                  </a>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                </dd>
              </div>
              
              {job.site_profile && (
                <div>
                  <dt className="text-xs text-gray-500">Site Profile</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {job.site_profile}
                  </dd>
                </div>
              )}
              
              {job.parent_job_id && (
                <div>
                  <dt className="text-xs text-gray-500">Parent Job</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/mining/jobs/${job.parent_job_id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View parent job →
                    </Link>
                  </dd>
                </div>
              )}
              
              {job.retry_job_id && (
                <div>
                  <dt className="text-xs text-gray-500">Retry Job</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/mining/jobs/${job.retry_job_id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View retry →
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Advanced Config */}
          {job.config && (
            <div className="rounded-lg border bg-white p-5">
              <h2 className="text-sm font-medium mb-4">Advanced Configuration</h2>
              
              <dl className="grid grid-cols-2 gap-4">
                {job.config.max_pages && (
                  <div>
                    <dt className="text-xs text-gray-500">Max Pages</dt>
                    <dd className="mt-1 text-sm font-medium">{job.config.max_pages}</dd>
                  </div>
                )}
                
                {job.config.force_page_count && (
                  <div>
                    <dt className="text-xs text-gray-500">Force Page Count</dt>
                    <dd className="mt-1 text-sm font-medium">{job.config.force_page_count}</dd>
                  </div>
                )}
                
                {job.config.detail_url_pattern && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500">Detail URL Pattern</dt>
                    <dd className="mt-1 text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {job.config.detail_url_pattern}
                    </dd>
                  </div>
                )}
                
                <div>
                  <dt className="text-xs text-gray-500">List Page Delay</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {job.config.list_page_delay_ms || 2000}ms
                  </dd>
                </div>
                
                <div>
                  <dt className="text-xs text-gray-500">Detail Page Delay</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {job.config.detail_delay_ms || 800}ms
                  </dd>
                </div>
                
                {job.config.test_mode && (
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">
                      Test Mode Enabled
                    </span>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-lg border bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">Notes</h2>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="h-3.5 w-3.5 inline mr-1" />
                  Edit
                </button>
              )}
            </div>
            
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
                  rows={4}
                  placeholder="Add notes about this job..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotesValue(job.notes || "");
                      setEditingNotes(false);
                    }}
                    className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
                  >
                    <X className="h-3.5 w-3.5 inline mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Save className="h-3.5 w-3.5 inline mr-1" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {job.notes || <span className="text-gray-400">No notes added</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right: Timeline & Actions */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-sm font-medium mb-4">Timeline</h2>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm">{formatDate(job.created_at)}</p>
                </div>
              </div>
              
              {job.started_at && (
                <div className="flex items-start gap-3">
                  <PlayCircle className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Started</p>
                    <p className="text-sm">{formatDate(job.started_at)}</p>
                  </div>
                </div>
              )}
              
              {job.completed_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Completed</p>
                    <p className="text-sm">{formatDate(job.completed_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-sm font-medium mb-4">Quick Actions</h2>
            
            <div className="space-y-2">
              <Link
                href={`/mining/jobs/${jobId}/console`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                <Terminal className="h-4 w-4" />
                View Console
              </Link>
              
              <Link
                href={`/mining/jobs/${jobId}/results`}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm border rounded-md ${
                  job.status === "completed"
                    ? "hover:bg-gray-50"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <FileText className="h-4 w-4" />
                View Results
                {job.total_found > 0 && (
                  <span className="ml-auto text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {job.total_found}
                  </span>
                )}
              </Link>
              
              <button
                onClick={handleDelete}
                disabled={deleting || job.status === "running"}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Help */}
      <div className="text-xs text-gray-500 flex items-center gap-4">
        <span>💡 Tip: Use Console for real-time logs and Results to review extracted data</span>
        {job.status === "running" && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Auto-refreshing every 5s
          </span>
        )}
      </div>
    </div>
  );
}
