"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

type Strategy = "playwright" | "http" | "auto";
type JobType = "url" | "file";
type SiteProfile = "auto" | "big5" | "gmaps";

type ConfigState = {
  max_pages: number;
  force_page_count: string; // backend'de number veya null'a çevrilebilir
  detail_url_pattern: string;
  list_page_delay_ms: number;
  detail_delay_ms: number;
  test_mode: boolean;
};

const DEFAULT_CONFIG: ConfigState = {
  max_pages: 10,
  force_page_count: "",
  detail_url_pattern: "",
  list_page_delay_ms: 2000,
  detail_delay_ms: 800,
  test_mode: false,
};

export default function NewMiningJobPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [jobType, setJobType] = useState<JobType>("url");
  const [input, setInput] = useState(""); // URL veya ileride file input için placeholder
  const [strategy, setStrategy] = useState<Strategy>("playwright");
  const [siteProfile, setSiteProfile] = useState<SiteProfile>("auto");
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // URL içinde big5 geçtiğinde uyarı
  const detectedBig5 = useMemo(
    () =>
      input.toLowerCase().includes("big5") ||
      input.toLowerCase().includes("big-5"),
    [input]
  );

  function applySiteProfile(profile: SiteProfile) {
    setSiteProfile(profile);

    // Seçilen profile göre bazı alanları otomatik doldur
    if (profile === "big5") {
      setStrategy("playwright");
      setConfig((prev) => ({
        ...prev,
        detail_url_pattern: "/Exhibitor/ExbDetails/",
        list_page_delay_ms: 2500,
        detail_delay_ms: 900,
        // force_page_count Big5 için sıklıkla gerekli, ama boş bırakıp
        // kullanıcıya bırakıyoruz; isterse advanced içinde doldurur.
      }));
    } else if (profile === "gmaps") {
      setStrategy("playwright");
      setConfig((prev) => ({
        ...prev,
        detail_url_pattern: "",
        list_page_delay_ms: 2500,
        detail_delay_ms: 1200,
      }));
    } else {
      // auto
      setStrategy("auto");
      setConfig((prev) => ({
        ...prev,
        detail_url_pattern: "",
        list_page_delay_ms: 2000,
        detail_delay_ms: 800,
      }));
    }
  }

  function handleConfigChange<K extends keyof ConfigState>(
    key: K,
    value: ConfigState[K]
  ) {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // force_page_count sayıya çevrilebilir, boşsa null göndeririz
    const forcePageCountNumber =
      config.force_page_count.trim() === ""
        ? null
        : Number(config.force_page_count);

    const payload = {
      name,
      type: jobType, // "url" veya ileride "file"
      input, // URL (veya dosya referansı)
      strategy,
      site_profile: siteProfile,
      config: {
        max_pages: config.max_pages,
        force_page_count: forcePageCountNumber,
        detail_url_pattern: config.detail_url_pattern || null,
        list_page_delay_ms: config.list_page_delay_ms,
        detail_delay_ms: config.detail_delay_ms,
        test_mode: config.test_mode,
      },
      status: "pending" as const,
      notes: notes.trim() || null,
    };

    console.log("NEW MINING JOB PAYLOAD →", payload);

    try {
      // Backend endpoint'i hazırsa yorum satırından çıkarılabilir
      const res = await fetch("/api/mining/jobs", {
        method: "POST",
        headers: {
          ...(getAuthHeaders() ?? {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Failed to create mining job", await res.text());
        alert("Mining job API hatası (detaylar console.log'da).");
      } else {
        alert("Mining job created successfully.");
      }
    } catch (err) {
      console.error("Error while creating mining job:", err);
      alert("Mining job gönderilirken hata oluştu (detaylar console.log'da).");
    } finally {
      setSubmitting(false);
      router.push("/mining/jobs");
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          New Mining Job
        </h1>
        <p className="text-sm text-gray-500">
          Create a new Playwright / HTTP mining job fully compatible with
          Liffy&apos;s backend.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* Basic fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">
              Job Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dubai HVAC Dealers – Google Maps"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Job type */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Job Type
            </label>
            <div className="mt-1 flex gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={jobType === "url"}
                  onChange={() => setJobType("url")}
                  className="h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span>URL</span>
              </label>
              <label className="inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
                <input
                  type="radio"
                  disabled
                  checked={jobType === "file"}
                  onChange={() => setJobType("file")}
                  className="h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span>File (coming soon)</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              For now only URL jobs are supported; file uploads will be added
              later.
            </p>
          </div>

          {/* Site profile */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Site Profile
            </label>
            <select
              value={siteProfile}
              onChange={(e) => applySiteProfile(e.target.value as SiteProfile)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="auto">Auto-detect</option>
              <option value="big5">Big5 Exhibition</option>
              <option value="gmaps">Google Maps</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Profiles prefill strategy & delays for common targets.
            </p>
          </div>

          {/* Strategy */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="playwright">Playwright (browser)</option>
              <option value="http">HTTP (fast)</option>
              <option value="auto">Auto (decide for me)</option>
            </select>
          </div>

          {/* Main input (URL) */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">
              Target URL
            </label>
            <input
              type="url"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://www.google.com/maps/search/hvac+dubai/"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              For URL jobs, this is the starting page to crawl.
            </p>

            {/* Big5 detection hint */}
            {detectedBig5 && siteProfile !== "big5" && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 mt-[1px] flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">
                    Detected Big5-style URL pattern.
                  </div>
                  <div className="mt-0.5">
                    Consider using the{" "}
                    <button
                      type="button"
                      className="underline font-semibold"
                      onClick={() => applySiteProfile("big5")}
                    >
                      &quot;Big5 Exhibition&quot; site profile
                    </button>{" "}
                    for better results.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra instructions for this mining job…"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Advanced settings */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <span>Advanced Settings</span>
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Max Pages
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={config.max_pages}
                    onChange={(e) =>
                      handleConfigChange(
                        "max_pages",
                        Number(e.target.value) || 1
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Maximum number of pages to crawl.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Force Page Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={config.force_page_count}
                    onChange={(e) =>
                      handleConfigChange("force_page_count", e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Optional override when the site hides total pages (e.g.
                    Big5). Leave empty to auto-detect.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    List Page Delay (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30000}
                    value={config.list_page_delay_ms}
                    onChange={(e) =>
                      handleConfigChange(
                        "list_page_delay_ms",
                        Number(e.target.value) || 0
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Delay between list pages (for pagination).
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Detail Page Delay (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30000}
                    value={config.detail_delay_ms}
                    onChange={(e) =>
                      handleConfigChange(
                        "detail_delay_ms",
                        Number(e.target.value) || 0
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Delay between opening individual detail pages.
                  </p>
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={config.test_mode}
                    onChange={(e) =>
                      handleConfigChange("test_mode", e.target.checked)
                    }
                    className="h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  Test Mode (crawl only the first page)
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  Useful while tuning selectors and profiles. Liffy will stop
                  after the first page.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Detail URL Pattern
                </label>
                <input
                  type="text"
                  value={config.detail_url_pattern}
                  onChange={(e) =>
                    handleConfigChange("detail_url_pattern", e.target.value)
                  }
                  placeholder="/Exhibitor/ExbDetails/"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Optional substring pattern used to detect exhibitor detail
                  links (e.g. Big5 exhibitor pages).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push("/mining/jobs")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-orange-500 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
