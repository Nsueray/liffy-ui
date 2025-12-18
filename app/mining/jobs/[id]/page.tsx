"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type MiningJob = {
  id: string;
  name: string;
  type: string;
  input: string;
  strategy: string;
  site_profile: string | null;
  status: string;
  progress: number | null;
  total_found: number | null;
  total_emails_raw: number | null;
  total_prospects_created: number | null;
  processed_pages: number | null;
  total_pages: number | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

function isValidUuid(id: string | undefined): id is string {
  if (!id) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export default function MiningJobDetailPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  const jobId = useMemo(
    () => (typeof params?.id === "string" ? params.id : ""),
    [params]
  );

  const [job, setJob] = useState<MiningJob | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Job detaylarını çek
  useEffect(() => {
    if (!jobId) {
      setError("Job ID missing in URL.");
      setLoading(false);
      return;
    }

    if (!isValidUuid(jobId)) {
      setError(
        `The job ID "${jobId}" is not valid. Job IDs must be valid UUIDs.`
      );
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadJob() {
      try {
        setLoading(true);
        setError(null);

        // JWT token'ı client tarafında localStorage'dan oku
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("liffy_token") ||
              localStorage.getItem("auth_token") ||
              localStorage.getItem("token")
            : null;

        const headers: Record<string, string> = {
          Accept: "application/json",
        };

        // Token varsa Authorization header ekle
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`/api/mining/jobs/${jobId}`, {
          method: "GET",
          signal: controller.signal,
          headers,
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            data?.error ||
            data?.message ||
            (!token
              ? "Missing auth token. Please log in again."
              : `Failed to load job (HTTP ${res.status}).`);
          setError(message);
          setLoading(false);
          return;
        }

        const payload = data?.job ?? data;

        if (!payload || !payload.id) {
          setError("Server did not return a valid job object.");
          setLoading(false);
          return;
        }

        setJob(payload);
        setError(null);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error loading job", err);
        setError("Unexpected error while loading job.");
      } finally {
        setLoading(false);
      }
    }

    loadJob();

    return () => controller.abort();
  }, [jobId]);

  const statusColor = useMemo(() => {
    if (!job?.status) return "bg-gray-100 text-gray-800";
    switch (job.status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }, [job?.status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/mining/jobs")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Jobs
          </button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {job?.name || "Mining Job"}
          </h1>
          {job && (
            <p className="mt-1 text-sm text-gray-500">
              Job ID: <span className="font-mono">{job.id}</span>
            </p>
          )}
        </div>

        {job && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}
          >
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        )}
      </div>

      {/* Error / Loading durumları */}
      {loading && (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Loading job details…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Unable to display this job</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/mining/jobs")}
            className="mt-3 inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
          >
            Back to jobs list
          </button>
        </div>
      )}

      {!loading && !error && job && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sol kolon: temel bilgiler */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Job Summary
              </h2>
              <dl className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Target URL</dt>
                  <dd className="break-all">
                    <a
                      href={job.input}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {job.input}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Strategy</dt>
                  <dd className="capitalize">
                    {job.strategy || "auto"}
                    {job.site_profile && (
                      <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        Profile: {job.site_profile}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="uppercase">{job.type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd>
                    {job.created_at
                      ? new Date(job.created_at).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Started</dt>
                  <dd>
                    {job.started_at
                      ? new Date(job.started_at).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Completed</dt>
                  <dd>
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Progress & Totals
              </h2>
              <dl className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">Progress</dt>
                  <dd>
                    {typeof job.progress === "number"
                      ? `${job.progress}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Pages</dt>
                  <dd>
                    {job.processed_pages ?? 0} / {job.total_pages ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Records Found</dt>
                  <dd>{job.total_found ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Emails Found</dt>
                  <dd>{job.total_emails_raw ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Prospects Created</dt>
                  <dd>{job.total_prospects_created ?? 0}</dd>
                </div>
              </dl>
            </div>

            {job.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <h2 className="font-semibold">Last Error</h2>
                <p className="mt-1 whitespace-pre-wrap">{job.error}</p>
              </div>
            )}
          </div>

          {/* Sağ kolon: aksiyonlar */}
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <h2 className="text-sm font-semibold text-gray-700">
                Actions
              </h2>
              <div className="mt-3 space-y-2">
                <Link
                  href={`/mining/jobs/${job.id}/console`}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium hover:bg-gray-50"
                >
                  View Live Console
                </Link>
                <Link
                  href={`/mining/jobs/${job.id}/results`}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium hover:bg-gray-50"
                >
                  View Results
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
