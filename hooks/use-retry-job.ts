"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RetryJobOptions = {
  onSuccess?: (newJobId: string) => void;
  onError?: (error: string) => void;
  autoRedirect?: boolean;
};

/**
 * Custom hook for retrying mining jobs
 */
export function useRetryJob(options: RetryJobOptions = {}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryJob = async (jobId: string) => {
    setRetrying(true);
    setError(null);

    try {
      const response = await fetch(`/api/mining/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to retry job");
      }

      const data = await response.json();
      
      if (options.onSuccess) {
        options.onSuccess(data.new_job_id);
      }

      if (options.autoRedirect !== false) {
        // Redirect to the new job's console
        router.push(`/mining/jobs/${data.new_job_id}/console`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      
      if (options.onError) {
        options.onError(errorMessage);
      }
      
      throw err;
    } finally {
      setRetrying(false);
    }
  };

  const getRetryHistory = async (jobId: string) => {
    try {
      const response = await fetch(`/api/mining/jobs/${jobId}/retry`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch retry history");
      }
      
      return await response.json();
    } catch (err) {
      console.error("Error fetching retry history:", err);
      return { retries: [], total_retries: 0 };
    }
  };

  return {
    retryJob,
    getRetryHistory,
    retrying,
    error,
  };
}
