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

// CHANGED: Default to "auto" per requirements
const [strategy, setStrategy] = useState<Strategy>("auto");
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

```
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

```

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

```
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

```

}

return (
<div className="max-w-3xl mx-auto">
<div className="mb-6">
<h1 className="text-2xl font-semibold tracking-tight">
New Mining Job
</h1>
<p className="text-sm text-gray-500">
Create a new mining job. Liffy will automatically handle the technical details.
</p>
</div>

```
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
          For now only URL jobs are supported.
        </p>
      </div>

      {/* HIDDEN: Site Profile Select */}
      {/* HIDDEN: Strategy Select */}

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
          placeholder="[https://www.google.com/maps/search/hvac+dubai/](https://www.google.com/maps/search/hvac+dubai/)"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Liffy will automatically detect the best mining method.
        </p>
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

    {/* HIDDEN: Advanced settings block */}

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

```

);
}
