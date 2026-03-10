"use client";

import { useState } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getAuthHeaders } from "@/lib/auth";
import { toast } from "react-hot-toast";
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
} from "lucide-react";

interface Source {
  url: string;
  source_type: "association" | "directory" | "fair" | "pdf" | "registry" | "other";
  estimated_companies: number;
  has_email_on_page: boolean | "unknown";
  language: string;
  notes: string;
}

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  association: { label: "Association", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Building2 },
  fair: { label: "Fair", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: Globe },
  pdf: { label: "PDF", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: FileText },
  directory: { label: "Directory", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: BookOpen },
  registry: { label: "Registry", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Landmark },
  other: { label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400", icon: FolderOpen },
};

export default function SourceDiscoveryPage() {
  useAuthGuard();

  const [fairName, setFairName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetCountries, setTargetCountries] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [searchedAt, setSearchedAt] = useState<string | null>(null);
  const [miningJobId, setMiningJobId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fairName.trim()) {
      toast.error("Please enter a fair name");
      return;
    }
    if (!industry.trim()) {
      toast.error("Please enter an industry");
      return;
    }

    setLoading(true);
    setSources([]);
    setSearchedAt(null);

    try {
      const countries = targetCountries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      // 90s timeout — web search can take up to 60s on backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch("/api/source-discovery", {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fair_name: fairName.trim(),
          industry: industry.trim(),
          target_countries: countries,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to discover sources");
      }

      const data = await res.json();
      setSources(data.sources || []);
      setSearchedAt(data.searched_at || new Date().toISOString());

      if (data.sources?.length > 0) {
        toast.success(`Found ${data.sources.length} sources`);
      } else {
        toast("No sources found. Try different search terms.", { icon: "🔍" });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Request timed out. Try again with narrower search terms.");
      } else {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMine = async (source: Source) => {
    try {
      const res = await fetch("/api/mining/jobs", {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "url",
          input: source.url,
          name: `Source Discovery — ${source.source_type}: ${new URL(source.url).hostname}`,
          strategy: "auto",
          config: { mining_mode: "full" },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mining job");
      }

      const data = await res.json();
      setMiningJobId(data.id || data.job?.id);
      toast.success(`Mining job created for ${new URL(source.url).hostname}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create mining job";
      toast.error(message);
    }
  };

  const emailIndicator = (value: boolean | "unknown") => {
    if (value === true) return <span className="text-green-600 dark:text-green-400 font-medium" title="Emails on page">Yes</span>;
    if (value === false) return <span className="text-red-500 dark:text-red-400 font-medium" title="No emails on page">No</span>;
    return <span className="text-gray-400" title="Unknown">?</span>;
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-orange-500" />
          Source Discovery
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Find company lists, association members, and exhibitor pages using AI-powered web search
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fair Name
            </label>
            <input
              type="text"
              value={fairName}
              onChange={(e) => setFairName(e.target.value)}
              placeholder="e.g. Yapi Fuari Istanbul 2025"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. construction materials, glass, ceramics"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Countries
            </label>
            <input
              type="text"
              value={targetCountries}
              onChange={(e) => setTargetCountries(e.target.value)}
              placeholder="e.g. Turkey, Germany, Italy"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-md transition-colors text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Discover Sources
              </>
            )}
          </button>

          {loading && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              This may take up to 60 seconds (AI web search)
            </span>
          )}
        </div>
      </form>

      {/* Results */}
      {searchedAt && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium">
            {sources.length} sources found
          </span>
          <span className="text-xs text-gray-400">
            Searched at {new Date(searchedAt).toLocaleString()}
          </span>
        </div>
      )}

      {miningJobId && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-400">
            Mining job created!{" "}
            <a
              href={`/mining/jobs/${miningJobId}/console`}
              className="underline font-medium hover:text-green-800 dark:hover:text-green-300"
            >
              View job console
            </a>
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((source, idx) => {
            const typeConfig = SOURCE_TYPE_CONFIG[source.source_type] || SOURCE_TYPE_CONFIG.other;
            const TypeIcon = typeConfig.icon;
            let hostname = "";
            try { hostname = new URL(source.url).hostname; } catch { hostname = source.url; }

            return (
              <div
                key={idx}
                className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig.label}
                      </span>
                      <span className="text-xs text-gray-400">{source.language}</span>
                    </div>

                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                    >
                      {hostname}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>

                    {source.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {source.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {source.estimated_companies || "?"}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">Companies</div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm">
                        {emailIndicator(source.has_email_on_page)}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">Emails</div>
                    </div>

                    <button
                      onClick={() => handleMine(source)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-md transition-colors"
                    >
                      <Pickaxe className="w-3.5 h-3.5" />
                      Mine
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && sources.length === 0 && !searchedAt && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Enter a fair name and industry to discover data sources</p>
          <p className="text-sm mt-1">AI will search the web for relevant company lists, directories, and exhibitor pages</p>
        </div>
      )}
    </div>
  );
}
