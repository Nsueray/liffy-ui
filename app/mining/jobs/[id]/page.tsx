"use client";

import React from "react"; // ✅ React import ekle JSX için
import { ReactElement } from "react"; // ✅ ReactElement type için
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
  PlayCircle,
  PauseCircle,
  StopCircle,
  AlertTriangle
} from "lucide-react";

type MiningJobStatus = "pending" | "running" | "completed" | "failed" | "paused" | "cancelled";
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
  config?: any;
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

// UUID validation
function isValidUuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

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
    paused: "bg-gray-100 text-gray-800 border-gray-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200"
  };

  // ✅ ReactElement kullan JSX.Element yerine
  const icons: Record<MiningJobStatus, ReactElement> = {
    pending: <Clock className="h-3 w-3" />,
    running: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    paused: <PauseCircle className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function MiningJobDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const jobId = params.id;
  
  // State
  const [job, setJob] = useState<MiningJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Validate ID before doing anything
  const isValidId = isValidUuid(jobId);

  const fetchJob = useCallback(async () => {
    // Don't fetch if ID is invalid
    if (!isValidId) {
      setError("Invalid job ID format");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("liffy_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/mining/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to fetch job" }));
        if (res.status === 404) {
          setError("Job not found");
        } else if (res.status === 401) {
          router.push("/login");
          return;
        } else {
          setError(errorData.error || `Error: ${res.status}`);
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      const jobData = data.job || data;
      setJob(jobData);
      setNotesValue(jobData.notes || "");
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }, [jobId, isValidId, router]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Auto-refresh for running jobs
  useEffect(() => {
    if (job?.status === "running") {
      const interval = setInterval(fetchJob, 5000);
      return () => clearInterval(interval);
    }
  }, [job?.status, fetchJob]);

  // Action handlers
  const handleCopyId = async () => {
    await navigator.clipboard.writeText(jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveNotes = async () => {
    setActionLoading("save-notes");
    try {
      const token = localStorage.getItem("liffy_token");
      const res = await fetch(`/api/mining/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ notes: notesValue })
      });

      if (res.ok) {
        const data = await res.json();
        setJob(data.job || data);
        setEditingNotes(false);
      }
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;
    
    setActionLoading("delete");
    try {
      const token = localStorage.getItem("liffy_token");
      await fetch(`/api/mining/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      router.push("/mining/jobs");
    } catch (err) {
      console.error("Failed to delete job:", err);
      setActionLoading(null);
    }
  };

  const handleRetry = async () => {
    setActionLoading("retry");
    try {
      const token = localStorage.getItem("liffy_token");
      const res = await fetch(`/api/mining/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.new_job_id) {
        router.push(`/mining/jobs/${data.new_job_id}/console`);
      }
    } catch (err) {
      console.error("Failed to retry job:", err);
      setActionLoading(null);
    }
  };

  const handleStatusAction = async (action: "pause" | "resume" | "cancel") => {
    setActionLoading(action);
    try {
      const token = localStorage.getItem("liffy_token");
      await fetch(`/api/mining/jobs/${jobId}/${action}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      fetchJob();
    } catch (err) {
      console.error(`Failed to ${action} job:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  // Invalid ID error
  if (!isValidId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Invalid Job ID</h2>
              <p className="mt-1 text-sm text-red-700">
                The job ID "{jobId}" is not valid. Job IDs must be valid UUIDs.
              </p>
              <Link
                href="/mining/jobs"
                className="mt-4 inline-flex items-center text-sm text-red-600 hover:text-red-700"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Jobs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading job details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-800">Error</h2>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={fetchJob}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Try Again
                </button>
                <Link
                  href="/mining/jobs"
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Back to Jobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No job found
  if (!job) {
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-white p-6 text-center">
          <p className="text-gray-500">Job not found</p>
          <Link
            href="/mining/jobs"
            className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Jobs
          </Link>
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

        <StatusBadge status={job.status} />
      </div>

      {/* Title & Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{job.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Created {formatDate(job.created_at)}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {job.status === "running" && (
            <>
              <button
                onClick={() => handleStatusAction("pause")}
                disabled={actionLoading !== null}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <PauseCircle className="h-4 w-4 inline mr-1" />
                Pause
              </button>
              <button
                onClick={() => handleStatusAction("cancel")}
                disabled={actionLoading !== null}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                <StopCircle className="h-4 w-4 inline mr-1" />
                Stop
              </button>
            </>
          )}
          {job.status === "paused" && (
            <button
              onClick={() => handleStatusAction("resume")}
              disabled={actionLoading !== null}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4 inline mr-1" />
              Resume
            </button>
          )}
          {(job.status === "failed" || job.status === "completed") && (
            <button
              onClick={handleRetry}
              disabled={actionLoading !== null}
              className="px-3 py-1.5 text-sm text-orange-600 border border-orange-200 rounded-md hover:bg-orange-50 disabled:opacity-50"
            >
              {actionLoading === "retry" ? (
                <RefreshCw className="h-4 w-4 inline mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 inline mr-1" />
              )}
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

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-medium mb-4">Statistics</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">Records Found</dt>
              <dd className="text-2xl font-semibold">{job.total_found}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Emails Extracted</dt>
              <dd className="text-2xl font-semibold">{job.total_emails_raw}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Prospects Created</dt>
              <dd className="text-2xl font-semibold">{job.total_prospects_created}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Duration</dt>
              <dd className="text-lg font-medium">{duration}</dd>
            </div>
          </dl>
        </div>

        {/* Configuration */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-medium mb-4">Configuration</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Type</dt>
              <dd className="font-medium">{job.type}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Strategy</dt>
              <dd className="font-medium">{job.strategy}</dd>
            </div>
            {job.site_profile && (
              <div>
                <dt className="text-xs text-gray-500">Site Profile</dt>
                <dd className="font-medium">{job.site_profile}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500">Target URL</dt>
              <dd className="truncate">
                <a
                  href={job.input}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {job.input}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Actions */}
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
            </Link>
            
            <button
              onClick={handleDelete}
              disabled={actionLoading !== null || job.status === "running"}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {actionLoading === "delete" ? "Deleting..." : "Delete Job"}
            </button>
          </div>
        </div>
      </div>

      {/* Notes Section */}
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
                disabled={actionLoading !== null}
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={actionLoading !== null}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading === "save-notes" ? "Saving..." : "Save"}
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
  );
}
