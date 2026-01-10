"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Download,
  Mail,
  Globe,
  Phone,
  MapPin,
  Check,
  X,
  Edit2,
  Save,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trash2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";

const isDev = process.env.NODE_ENV !== "production";

// Types matching backend schema
type MiningResult = {
  id: string;
  job_id: string;
  company_name: string | null;
  contact_name: string | null;
  job_title: string | null;
  emails: string[];
  website: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  source_url: string | null;
  confidence_score: number | null; // 0-100
  verification_status: "unverified" | "valid" | "invalid" | "risky";
  status: "new" | "reviewed" | "imported" | "skipped";
  created_at: string;
  updated_at: string | null;
};

type JobSummary = {
  id: string;
  name: string;
  status: string;
  total_found: number;
  total_emails_raw: number;
  total_prospects_created: number;
  completed_at?: string;
};

type Summary = {
  total: number;
  with_email: number;
  without_email: number;
  reviewed: number;
  imported: number;
  countries: Record<string, number>;
  verification_stats: {
    verified: number;
    unverified: number;
    invalid: number;
    risky: number;
  };
};

// Mock data for development
const MOCK_RESULTS: MiningResult[] = [
  {
    id: "1",
    job_id: "job_1",
    company_name: "ABUMET NIGERIA LIMITED",
    contact_name: "Esther Duruibe",
    job_title: "Sales Manager",
    emails: ["esther.duruibe@abumet.com"],
    website: "https://abumet.com",
    phone: "+234 803 456 7890",
    country: "Nigeria",
    city: "Lagos",
    address: null,
    source_url: "https://exhibitors.big5constructnigeria.com/...",
    confidence_score: 95,
    verification_status: "valid",
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    job_id: "job_1",
    company_name: "ACERO STRUCTURAL STEEL",
    contact_name: "Damien Mendez",
    job_title: null,
    emails: ["damien.mendez@acero.ae", "info@acero.ae"],
    website: "https://acero.ae",
    phone: "+971 4 123 4567",
    country: "UAE",
    city: "Dubai",
    address: null,
    source_url: null,
    confidence_score: 88,
    verification_status: "unverified",
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Components
function VerificationBadge({ status }: { status?: string }) {
  if (!status) return null;

  const styles = {
    valid: "bg-green-100 text-green-800 border-green-200",
    unverified: "bg-gray-100 text-gray-800 border-gray-200",
    invalid: "bg-red-100 text-red-800 border-red-200",
    risky: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  const icons = {
    valid: <CheckCircle className="h-3 w-3" />,
    unverified: <AlertCircle className="h-3 w-3" />,
    invalid: <XCircle className="h-3 w-3" />,
    risky: <AlertCircle className="h-3 w-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${
        styles[status as keyof typeof styles] || styles.unverified
      }`}
    >
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  );
}

function ConfidenceScore({ score }: { score?: number | null }) {
  if (score == null) return null;

  const color =
    score >= 80
      ? "text-green-600"
      : score >= 60
      ? "text-yellow-600"
      : "text-red-600";

  return <span className={`text-xs font-medium ${color}`}>{score}%</span>;
}

function EditableCell({
  value,
  onSave,
  type = "text",
}: {
  value: string | null;
  onSave: (value: string) => void;
  type?: "text" | "email" | "url";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-orange-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
        />
        <button onClick={handleSave} className="p-1 hover:bg-green-100 rounded">
          <Check className="h-3 w-3 text-green-600" />
        </button>
        <button onClick={handleCancel} className="p-1 hover:bg-red-100 rounded">
          <X className="h-3 w-3 text-red-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span className="text-sm">
        {value || <span className="text-gray-400">—</span>}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded"
      >
        <Edit2 className="h-3 w-3 text-gray-500" />
      </button>
    </div>
  );
}

export default function MiningJobResultsPage() {
  useAuthGuard();

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
  const [job, setJob] = useState<JobSummary | null>(null);
  const [results, setResults] = useState<MiningResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editedResults, setEditedResults] = useState<
    Record<string, Partial<MiningResult>>
  >({});

  // Filters
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState<
    "all" | "with" | "without"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "reviewed" | "imported" | "skipped"
  >("all");
  const [verificationFilter, setVerificationFilter] = useState<
    "all" | "valid" | "unverified" | "invalid" | "risky"
  >("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [totalFromServer, setTotalFromServer] = useState(0);

  // Fetch data
  const fetchResults = useCallback(async () => {
    if (!jobId || !isValidUuid(jobId)) {
      setError("Job not found or invalid job id.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const authHeaders = getAuthHeaders() ?? {};

      // Fetch job details
      const jobRes = await fetch(`/api/mining/jobs/${jobId}`, {
        headers: authHeaders,
      });
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData.job || jobData);
      } else if (jobRes.status === 400 || jobRes.status === 404) {
        const message =
          "Job not found or invalid job id. Please check the link and try again.";
        setError(message);
        setLoading(false);
        return;
      }

      // Fetch results with server-side pagination
      const res = await fetch(`/api/mining/jobs/${jobId}/results?page=${page}&limit=${ITEMS_PER_PAGE}`, {
        headers: authHeaders,
      });

      const data = await res
        .json()
        .catch(() => ({ error: `Failed to parse results for ${jobId}` }));

      if (!res.ok) {
        const message =
          res.status === 400
            ? "Job not found or invalid job id."
            : data?.error || `Failed to fetch results: ${res.status}`;
        throw new Error(message);
      }

      const items: any[] = data.results || data.items || data || [];

      // Set total from server pagination
      if (data.pagination?.total !== undefined) {
        setTotalFromServer(data.pagination.total);
      } else {
        setTotalFromServer(items.length);
      }

      // Transform data if needed (handle backward compatibility)
      const transformedResults: MiningResult[] = items.map((item: any) => ({
        ...item,
        job_id: item.job_id || item.jobId || jobId,
        emails: Array.isArray(item.emails)
          ? item.emails
          : item.email
          ? [item.email]
          : [],
        company_name:
          item.company_name || item.companyName || item.company || null,
        contact_name: item.contact_name || item.contactName || null,
        job_title: item.job_title || item.jobTitle || null,
        website: item.website || null,
        phone: item.phone || null,
        country: item.country || null,
        city: item.city || null,
        address: item.address ?? null,
        source_url: item.source_url || item.sourceUrl || null,
        confidence_score:
          item.confidence_score ?? item.confidenceScore ?? null,
        verification_status: item.verification_status || "unverified",
        status: item.status || "new",
        created_at: item.created_at || item.createdAt || new Date().toISOString(),
        updated_at: item.updated_at || item.updatedAt || null,
      }));

      setResults(transformedResults);
    } catch (err) {
      console.error("Error loading results:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load results"
      );

      // Sadece development ortamında mock data göster
      if (isDev) {
        setResults(MOCK_RESULTS);
        setTotalFromServer(MOCK_RESULTS.length);
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Filtre değişince sayfayı başa al
  useEffect(() => {
    setPage(1);
  }, [search, emailFilter, statusFilter, verificationFilter, countryFilter]);

  // Calculate summary from current page results
  const summary = useMemo((): Summary => {
    const total = results.length;
    const withEmail = results.filter((r) => r.emails.length > 0).length;
    const withoutEmail = total - withEmail;
    const reviewed = results.filter((r) => r.status === "reviewed").length;
    const imported = results.filter((r) => r.status === "imported").length;

    const countries: Record<string, number> = {};
    const verificationStats = {
      verified: 0,
      unverified: 0,
      invalid: 0,
      risky: 0,
    };

    results.forEach((r) => {
      // Countries
      const country = r.country || "Unknown";
      countries[country] = (countries[country] || 0) + 1;

      // Verification
      if (r.verification_status === "valid") verificationStats.verified++;
      else if (r.verification_status === "invalid")
        verificationStats.invalid++;
      else if (r.verification_status === "risky") verificationStats.risky++;
      else verificationStats.unverified++;
    });

    return {
      total,
      with_email: withEmail,
      without_email: withoutEmail,
      reviewed,
      imported,
      countries,
      verification_stats: verificationStats,
    };
  }, [results]);

  // Filter results (client-side filtering on current page)
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      // Email filter
      if (emailFilter === "with" && r.emails.length === 0) return false;
      if (emailFilter === "without" && r.emails.length > 0) return false;

      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      // Verification filter
      if (
        verificationFilter !== "all" &&
        r.verification_status !== verificationFilter
      )
        return false;

      // Country filter
      if (countryFilter !== "all" && r.country !== countryFilter) return false;

      // Search
      if (search) {
        const searchLower = search.toLowerCase();
        const searchableText = [
          r.company_name,
          r.contact_name,
          ...r.emails,
          r.website,
          r.phone,
          r.country,
          r.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      return true;
    });
  }, [
    results,
    emailFilter,
    statusFilter,
    verificationFilter,
    countryFilter,
    search,
  ]);

  // Server handles pagination - no client-side slice needed
  const paginatedResults = filteredResults;

  // Total pages from server
  const totalPages = totalFromServer === 0
    ? 1
    : Math.ceil(totalFromServer / ITEMS_PER_PAGE);

  // Actions
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedResults.map((r) => r.id));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleEditCell = (
    resultId: string,
    field: string,
    value: string
  ) => {
    setEditedResults((prev) => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        [field]: value,
      },
    }));
  };

  const handleSaveEdits = async () => {
    const entries = Object.entries(editedResults);
    if (entries.length === 0) return;

    try {
      // Save edited results to backend
      await Promise.all(
        entries.map(([id, changes]) =>
          fetch(`/api/mining/results/${id}`, {
            method: "PATCH",
            headers: {
              ...(getAuthHeaders() ?? {}),
              "Content-Type": "application/json",
            },
            body: JSON.stringify(changes),
          })
        )
      );

      // Update local state
      setResults((prev) =>
        prev.map((r) => ({
          ...r,
          ...(editedResults[r.id] || {}),
        }))
      );

      setEditedResults({});
      alert("Changes saved successfully");
    } catch (err) {
      console.error("Error saving edits:", err);
      alert("Error saving changes");
    }
  };

  /* ======================================================
     🔥 UPDATED IMPORT LOGIC - Email olmayan skip, verification opsiyonel
     ====================================================== */
  const handleImportToLeads = async () => {
    if (!jobId || !isValidUuid(jobId)) {
      alert("Geçersiz job ID – lütfen Mining Jobs sayfasından tekrar deneyin.");
      return;
    }

    const selected = results.filter((r) => selectedIds.includes(r.id));

    if (selected.length === 0) {
      alert("Please select results to import.");
      return;
    }

    // 🟡 Email olanları ve olmayanları ayır
    const withEmail = selected.filter((r) => r.emails.length > 0);
    const withoutEmail = selected.filter((r) => r.emails.length === 0);

    // 🟡 INFO: email olmayanlar skip edilecek
    if (withoutEmail.length > 0) {
      alert(
        `${withoutEmail.length} selected result(s) do not have an email and will be skipped.`
      );
    }

    if (withEmail.length === 0) {
      alert("No results with email to import.");
      return;
    }

    // 🟡 OPTIONAL verification (non-blocking)
    const unverified = withEmail.filter(
      (r) => r.verification_status !== "valid"
    );

    if (unverified.length > 0) {
      const choice = confirm(
        `${unverified.length} email(s) are not verified.\n\nPress OK to continue without verification.\nPress Cancel if you want to verify first.`
      );

      if (!choice) {
        return;
      }
    }

    try {
      // 🔵 IMPORT - Doğrudan lead objesi gönder
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: withEmail.map((r) => ({
            email: r.emails[0],
            name: r.contact_name,
            company: r.company_name,
            country: r.country,
            source_type: "mining",
            source_ref: jobId,
            verification_status: r.verification_status,
            meta: {
              id: r.id,
              job_id: r.job_id,
              job_title: r.job_title,
              emails: r.emails,
              website: r.website,
              phone: r.phone,
              city: r.city,
              address: r.address,
              source_url: r.source_url,
              confidence_score: r.confidence_score,
            },
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Import failed");
      }

      const data = await res.json();

      // 🟢 UI STATUS UPDATE - Sadece email olanları imported yap
      setResults((prev) =>
        prev.map((r) =>
          selectedIds.includes(r.id) && r.emails.length > 0
            ? { ...r, status: "imported" as const }
            : r
        )
      );

      alert(
        `✅ Imported ${withEmail.length} lead(s) successfully.\n${withoutEmail.length > 0 ? `⚠️ ${withoutEmail.length} result(s) without email were skipped.` : ""}`
      );

      setSelectedIds([]);
    } catch (err) {
      console.error("Error importing to leads:", err);
      alert(err instanceof Error ? err.message : "Error importing to leads");
    }
  };

  const handleExportCSV = () => {
    const selectedResults =
      selectedIds.length > 0
        ? results.filter((r) => selectedIds.includes(r.id))
        : filteredResults;

    const csv =
      [
        [
          "Company",
          "Contact Name",
          "Job Title",
          "Emails",
          "Website",
          "Phone",
          "Country",
          "City",
          "Confidence",
          "Verification",
        ],
        ...selectedResults.map((r) => [
          r.company_name || "",
          r.contact_name || "",
          r.job_title || "",
          r.emails.join("; "),
          r.website || "",
          r.phone || "",
          r.country || "",
          r.city || "",
          r.confidence_score?.toString() || "",
          r.verification_status || "",
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mining-results-${jobId || "unknown"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyEmails = async () => {
    const selectedResults = results.filter((r) =>
      selectedIds.includes(r.id)
    );
    const emailsToVerify = selectedResults.flatMap((r) => r.emails);

    if (emailsToVerify.length === 0) {
      alert("No emails to verify");
      return;
    }

    if (
      !confirm(
        `Verify ${emailsToVerify.length} emails? This will use your verification credits.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/verification/verify", {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails: emailsToVerify }),
      });

      if (!res.ok) throw new Error("Verification failed");

      alert(`Verification started for ${emailsToVerify.length} emails`);

      // Refresh results after a short delay
      setTimeout(fetchResults, 3000);
    } catch (err) {
      console.error("Error starting verification:", err);
      alert("Error starting verification");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`Delete ${selectedIds.length} selected results?`)) return;

    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/mining/results/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders() ?? {},
          })
        )
      );

      setResults((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error("Error deleting results:", err);
      alert("Error deleting results");
    }
  };

  // Website helper: hem URL crash etmesin hem domain gösterelim
  const formatWebsite = (website: string | null | undefined) => {
    if (!website) return null;

    let href = website.trim();
    if (!href) return null;

    if (!/^https?:\/\//i.test(href)) {
      href = `https://${href}`;
    }

    try {
      const url = new URL(href);
      return { href: url.toString(), label: url.hostname };
    } catch {
      return { href, label: website };
    }
  };

  // Geçersiz / eksik jobId ise erken çık
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
            <h1 className="text-xl font-semibold">Mining Results</h1>
            <p className="text-sm text-gray-500">
              Invalid or missing job ID in URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/mining/jobs/${jobId}/console`)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">Mining Results Review</h1>
            <p className="text-sm text-gray-500">
              {job?.name || `Job ${jobId}`} • {totalFromServer} results found
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchResults}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1 inline" />
            Refresh
          </button>
          <button
            onClick={handleImportToLeads}
            disabled={selectedIds.length === 0}
            className="px-4 py-1.5 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 mr-1 inline" />
            Import to Leads ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="inline h-4 w-4 mr-1" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">Total Results</div>
          <div className="mt-1 text-xl font-semibold">{totalFromServer}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">With Email</div>
          <div className="mt-1 text-xl font-semibold text-green-600">
            {summary.with_email}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">Verified</div>
          <div className="mt-1 text-xl font-semibold text-green-600">
            {summary.verification_stats.verified}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">Unverified</div>
          <div className="mt-1 text-xl font-semibold text-gray-600">
            {summary.verification_stats.unverified}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">Reviewed</div>
          <div className="mt-1 text-xl font-semibold text-blue-600">
            {summary.reviewed}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-500">Imported</div>
          <div className="mt-1 text-xl font-semibold text-green-600">
            {summary.imported}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, contact, email..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All Emails</option>
            <option value="with">With Email</option>
            <option value="without">Without Email</option>
          </select>

          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All Verification</option>
            <option value="valid">Valid</option>
            <option value="unverified">Unverified</option>
            <option value="invalid">Invalid</option>
            <option value="risky">Risky</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="imported">Imported</option>
            <option value="skipped">Skipped</option>
          </select>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All Countries</option>
            {Object.entries(summary.countries)
              .sort((a, b) => b[1] - a[1])
              .map(([country, count]) => (
                <option key={country} value={country}>
                  {country} ({count})
                </option>
              ))}
          </select>

          <span className="text-sm text-gray-500">
            Showing {paginatedResults.length} of {totalFromServer}
          </span>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.length} result
            {selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            {Object.keys(editedResults).length > 0 && (
              <button
                onClick={handleSaveEdits}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-1 inline" />
                Save Edits ({Object.keys(editedResults).length})
              </button>
            )}
            <button
              onClick={handleVerifyEmails}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-1 inline" />
              Verify Emails
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-sm border bg-white rounded-md hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-1 inline" />
              Export CSV
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 bg-white rounded-md hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1 inline" />
              Delete
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === paginatedResults.length &&
                      paginatedResults.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                </th>
                <th className="px-3 py-3 text-left">Company</th>
                <th className="px-3 py-3 text-left">Contact</th>
                <th className="px-3 py-3 text-left">Email(s)</th>
                <th className="px-3 py-3 text-left">Website</th>
                <th className="px-3 py-3 text-left">Phone</th>
                <th className="px-3 py-3 text-left">Location</th>
                <th className="px-3 py-3 text-center">Confidence</th>
                <th className="px-3 py-3 text-center">Verification</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedResults.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-8 text-center text-gray-500"
                  >
                    {filteredResults.length === 0
                      ? "No results match your filters"
                      : "No results on this page"}
                  </td>
                </tr>
              ) : (
                paginatedResults.map((result) => {
                  const edited = editedResults[result.id];
                  const displayResult = { ...result, ...edited };

                  const websiteInfo = formatWebsite(displayResult.website);

                  return (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(result.id)}
                          onChange={() => toggleSelection(result.id)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell
                          value={displayResult.company_name}
                          onSave={(value) =>
                            handleEditCell(result.id, "company_name", value)
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <EditableCell
                            value={displayResult.contact_name}
                            onSave={(value) =>
                              handleEditCell(result.id, "contact_name", value)
                            }
                          />
                          {displayResult.job_title && (
                            <span className="text-xs text-gray-500">
                              {displayResult.job_title}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          {displayResult.emails.map((email, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <a
                                href={`mailto:${email}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {email}
                              </a>
                            </div>
                          ))}
                          {displayResult.emails.length === 0 && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {websiteInfo ? (
                          <a
                            href={websiteInfo.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            {websiteInfo.label}
                          </a>
                        ) : (
                          <EditableCell
                            value={null}
                            onSave={(value) =>
                              handleEditCell(result.id, "website", value)
                            }
                            type="url"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {displayResult.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">
                              {displayResult.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            {[displayResult.city, displayResult.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ConfidenceScore
                          score={displayResult.confidence_score}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <VerificationBadge
                          status={displayResult.verification_status}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full
                          ${
                            displayResult.status === "imported"
                              ? "bg-green-100 text-green-800"
                              : displayResult.status === "reviewed"
                              ? "bg-blue-100 text-blue-800"
                              : displayResult.status === "skipped"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {displayResult.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-center gap-1">
                          {displayResult.source_url && (
                            <a
                              href={displayResult.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 rounded"
                              title="View source"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              if (displayResult.emails.length === 0) return;
                              navigator.clipboard.writeText(
                                displayResult.emails.join(", ")
                              );
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Copy emails"
                          >
                            <Copy className="h-3.5 w-3.5 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(page - 1) * ITEMS_PER_PAGE + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(page * ITEMS_PER_PAGE, totalFromServer)}
              </span>{" "}
              of{" "}
              <span className="font-medium">{totalFromServer}</span>{" "}
              results
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {totalPages}
              </span>
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

      {/* Help Text */}
      <div className="text-xs text-gray-500">
        <p>
          💡 Click on company names, contacts, or websites to edit them
          inline. Your changes will be highlighted and can be saved in bulk.
        </p>
        <p>
          📧 Select results and click "Import to Leads" to move them to your
          leads database.
        </p>
        <p>
          ✅ Use "Verify Emails" to validate email addresses before importing
          (uses verification credits).
        </p>
      </div>
    </div>
  );
}
