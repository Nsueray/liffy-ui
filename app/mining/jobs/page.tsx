"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw, 
  Download, 
  Trash2, 
  AlertCircle,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Mail
} from "lucide-react";
import { toast } from "react-hot-toast";
import { getAuthHeaders } from "@/lib/auth";

// Import the RetryJobButton component
// Assuming you have this component in your components folder
// import { RetryJobButton } from "@/components/mining/retry-job-button";

// For now, include it inline (you can move this to a separate file)
function RetryJobButton({
  jobId,
  jobName,
  onRetryComplete,
  className = "",
}: {
  jobId: string;
  jobName?: string;
  onRetryComplete?: () => void;
  className?: string;
}) {
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();

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

      const data = await response.json();
      
      toast.success(`Job retry created! Redirecting to console...`);
      
      if (onRetryComplete) {
        onRetryComplete();
      }
      
      // Redirect to the new job's console
      setTimeout(() => {
        router.push(`/mining/jobs/${data.new_job_id}/console`);
      }, 1500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to retry job";
      toast.error(errorMessage);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <button
      onClick={handleRetry}
      disabled={retrying}
      className={`px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 ${className}`}
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

// Types matching backend schema
type MiningJobStatus = "pending" | "running" | "completed" | "failed";
type Strategy = "auto" | "playwright" | "http";

type MiningJob = {
  id: string;
  organizer_id: string;
  name: string;
  type: "url" | "file";
  input: string;
  strategy: Strategy;
  site_profile?: string;
  status: MiningJobStatus;
  progress?: number; // 0-100 for running jobs
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
  parent_job_id?: string; // For retry tracking
  retry_job_id?: string;  // Reference to the retry job
};

type SortField = "created_at" | "name" | "status" | "total_found";
type SortOrder = "asc" | "desc";

// API hooks
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
    total_emails: 0
  });

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search,
        ...(statusFilter !== "all" && { status: statusFilter })
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
      // Use mock data in case of error (for development)
      setJobs(MOCK_JOBS);
      setTotalCount(MOCK_JOBS.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh for running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(j => j.status === "running");
    if (hasRunningJobs) {
      const interval = setInterval(fetchJobs, 5000); // Refresh every 5s
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  return { jobs, loading, error, totalCount, stats, refetch: fetchJobs };
}

// Mock data for development
const MOCK_JOBS: MiningJob[] = [
  {
    id: "bd4fccb0-00e7-4992-a355-95189bb580c2",
    organizer_id: "org_1",
    name: "Big5 Nigeria Exhibitors",
    type: "url",
    input: "https://exhibitors.big5constructnigeria.com/...",
    strategy: "playwright",
    site_profile: "big5",
    status: "completed",
    total_found: 172,
    total_emails_raw: 173,
    total_prospects_created: 168,
    created_at: "2025-11-24T10:00:00Z",
    completed_at: "2025-11-24T10:09:42Z",
    updated_at: "2025-11-24T10:09:42Z"
  },
  {
    id: "job_2",
    organizer_id: "org_1",
    name: "Dubai HVAC Dealers",
    type: "url",
    input: "https://maps.google.com/search/hvac+dubai",
    strategy: "playwright",
    status: "running",
    progress: 45,
    total_found: 89,
    total_emails_raw: 67,
    total_prospects_created: 0,
    created_at: "2025-11-25T08:00:00Z",
    started_at: "2025-11-25T08:01:00Z",
    updated_at: "2025-11-25T08:15:00Z"
  },
  {
    id: "job_3",
    organizer_id: "org_1",
    name: "Istanbul Architects List",
    type: "file",
    input: "architects.csv",
    strategy: "http",
    status: "failed",
    error: "Connection timeout",
    total_found: 0,
    total_emails_raw: 0,
    total_prospects_created: 0,
    created_at: "2025-11-25T09:30:00Z",
    updated_at: "2025-11-25T09:30:00Z"
  }
];

// Components
function StatusBadge({ status }: { status: MiningJobStatus }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200"
  };

  const icons = {
    pending: <Clock className="h-3 w-3" />,
    running: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color = "gray" }: any) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800"
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

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-4"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
      ))}
    </div>
  );
}

function EmptyState({ statusFilter }: { statusFilter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Database className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        No mining jobs {statusFilter !== "all" ? `with status "${statusFilter}"` : "yet"}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {statusFilter !== "all" 
          ? "Try changing your filters or create a new job"
          : "Get started by creating your first mining job"}
      </p>
      <Link
        href="/mining/jobs/new"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600"
      >
        Create Mining Job
      </Link>
    </div>
  );
}

export default function MiningJobsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MiningJobStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { jobs, loading, error, totalCount, stats, refetch } = useMiningJobs(
    page, 
    search, 
    statusFilter
  );

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Sort jobs
  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      
      if (sortBy === "created_at") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return sorted;
  }, [jobs, sortBy, sortOrder]);

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedJobs.length === sortedJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(sortedJobs.map(j => j.id));
    }
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedJobs.length} jobs?`)) return;
    
    try {
      await Promise.all(
        selectedJobs.map(id =>
          fetch(`/api/mining/jobs/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
          })
        )
      );
      setSelectedJobs([]);
      refetch();
      toast.success(`${selectedJobs.length} jobs deleted`);
    } catch (err) {
      toast.error("Error deleting jobs");
    }
  };

  const handleBulkExport = () => {
    const selectedData = sortedJobs.filter(j => selectedJobs.includes(j.id));
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" 
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mining Jobs</h1>
          <p className="text-sm text-gray-500">
            Monitor and manage your data extraction jobs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refetch}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
          <Link
            href="/mining/jobs/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600"
          >
            + New Mining Job
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard title="Total Jobs" value={stats.total} icon={Database} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard title="Running" value={stats.running} icon={Activity} color="blue" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="red" />
        <StatCard title="Total Emails" value={stats.total_emails} icon={Mail} color="green" />
      </div>

      {/* Filters */}
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
            </select>
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
            <button
              onClick={handleBulkExport}
              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </button>
            <button
              onClick={() => setSelectedJobs([])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-white">
        {loading && !jobs.length ? (
          <div className="p-8">
            <TableSkeleton />
          </div>
        ) : error && !jobs.length ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Error loading jobs: {error}</p>
            <button 
              onClick={refetch}
              className="mt-4 text-sm text-orange-600 hover:text-orange-700"
            >
              Try again
            </button>
          </div>
        ) : sortedJobs.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
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
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("name")}
                  >
                    Job Name <SortIcon field="name" />
                  </th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("status")}
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-4 py-3 text-center">Progress</th>
                  <th 
                    className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("total_found")}
                  >
                    Found <SortIcon field="total_found" />
                  </th>
                  <th className="px-4 py-3 text-right">Emails</th>
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("created_at")}
                  >
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
                        <Link 
                          href={`/mining/jobs/${job.id}`}
                          className="font-medium text-gray-900 hover:text-orange-600"
                        >
                          {job.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {job.site_profile && (
                            <span>Profile: {job.site_profile}</span>
                          )}
                          {job.parent_job_id && (
                            <span className="text-blue-600">• Retry</span>
                          )}
                          {job.retry_job_id && (
                            <span className="text-green-600">• Has retry</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 truncate max-w-[200px]">
                          {job.input}
                        </span>
                        <span className="text-xs text-gray-400">{job.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-600 capitalize">
                        {job.strategy}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {job.status === "running" && job.progress ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {job.progress}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {job.total_found}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {job.total_emails_raw}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/mining/jobs/${job.id}/console`}
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                        >
                          Console
                        </Link>
                        {job.status === "completed" && (
                          <Link
                            href={`/mining/jobs/${job.id}/results`}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          >
                            Results
                          </Link>
                        )}
                        {job.status === "failed" && (
                          <RetryJobButton
                            jobId={job.id}
                            jobName={job.name}
                            onRetryComplete={refetch}
                          />
                        )}
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
              <span className="font-medium">
                {Math.min(page * ITEMS_PER_PAGE, totalCount)}
              </span>{" "}
              of <span className="font-medium">{totalCount}</span> results
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility functions
function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === "string" ? `"${val}"` : val
    ).join(",")
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
