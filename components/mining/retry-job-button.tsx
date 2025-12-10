// =====================================
// components/mining/retry-job-button.tsx
// =====================================
"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useRetryJob } from "@/hooks/use-retry-job";

type RetryJobButtonProps = {
  jobId: string;
  jobName?: string;
  onRetryComplete?: (newJobId: string) => void;
  className?: string;
  variant?: "button" | "icon";
};

export function RetryJobButton({
  jobId,
  jobName,
  onRetryComplete,
  className = "",
  variant = "button",
}: RetryJobButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { retryJob, retrying, error } = useRetryJob({
    onSuccess: (newJobId) => {
      setShowConfirm(false);
      if (onRetryComplete) {
        onRetryComplete(newJobId);
      }
    },
    onError: (error) => {
      alert(`Failed to retry job: ${error}`);
    },
  });

  const handleRetry = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    await retryJob(jobId);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-amber-900">
          Retry {jobName ? `"${jobName}"` : "this job"}?
        </span>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-2 py-0.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {retrying ? "Retrying..." : "Confirm"}
        </button>
        <button
          onClick={handleCancel}
          className="px-2 py-0.5 text-xs border border-amber-300 rounded hover:bg-amber-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleRetry}
        disabled={retrying}
        className={`p-1.5 hover:bg-gray-100 rounded disabled:opacity-50 ${className}`}
        title="Retry job"
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
      </button>
    );
  }

  return (
    <button
      onClick={handleRetry}
      disabled={retrying}
      className={`inline-flex items-center px-3 py-1.5 text-sm border border-red-200 text-red-600 bg-white rounded-md hover:bg-red-50 disabled:opacity-50 ${className}`}
    >
      <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? "animate-spin" : ""}`} />
      {retrying ? "Retrying..." : "Retry"}
    </button>
  );
}

