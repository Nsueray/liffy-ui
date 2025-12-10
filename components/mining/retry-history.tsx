// =====================================
// components/mining/retry-history.tsx
// =====================================
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useRetryJob } from "@/hooks/use-retry-job";

type RetryHistoryProps = {
  jobId: string;
  className?: string;
};

type RetryJob = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_found: number;
  total_emails_raw: number;
};

export function RetryHistory({ jobId, className = "" }: RetryHistoryProps) {
  const [retries, setRetries] = useState<RetryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const { getRetryHistory } = useRetryJob();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const data = await getRetryHistory(jobId);
      setRetries(data.retries || []);
      setLoading(false);
    };

    fetchHistory();
  }, [jobId]);

  if (loading) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Loading retry history...
      </div>
    );
  }

  if (retries.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg border bg-gray-50 p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Retry History ({retries.length})
      </h3>
      <div className="space-y-2">
        {retries.map((retry) => (
          <div
            key={retry.id}
            className="flex items-center justify-between p-2 bg-white rounded border"
          >
            <div className="flex items-center gap-3">
              {retry.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : retry.status === "failed" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : retry.status === "running" ? (
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-500" />
              )}
              <div>
                <Link
                  href={`/mining/jobs/${retry.id}/console`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {retry.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {new Date(retry.created_at).toLocaleString()} •{" "}
                  {retry.total_found} found • {retry.total_emails_raw} emails
                </p>
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${
                retry.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : retry.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : retry.status === "running"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {retry.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
