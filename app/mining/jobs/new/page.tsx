"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Globe, FileText, UploadCloud, FileType } from "lucide-react";
import { toast } from "react-hot-toast";
import { getAuthHeaders } from "@/lib/auth";

export default function NewMiningJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [jobType, setJobType] = useState<"url" | "file">("url");
  
  // Form States
  const [name, setName] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState("auto");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (jobType === "url" && !inputUrl) {
      toast.error("Please enter a target URL");
      return;
    }
    if (jobType === "file" && !selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setLoading(true);

    try {
      let response;

      if (jobType === "url") {
        // --- URL MINING (JSON SEND) ---
        response = await fetch("/api/mining/jobs", {
          method: "POST",
          headers: {
            ...(getAuthHeaders() ?? {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "url",
            input: inputUrl,
            name: name || `Mining Job - ${new Date().toLocaleString()}`,
            strategy,
            config: {}
          }),
        });
      } else {
        // --- FILE MINING (FORM DATA SEND) ---
        const formData = new FormData();
        formData.append("file", selectedFile as Blob);
        formData.append("type", "file"); 
        formData.append("name", name || selectedFile?.name || "File Mining Job");
        formData.append("strategy", "auto"); 
        
        // Construct headers for file upload
        const authHeaders = getAuthHeaders() ?? {};
        // Do NOT set Content-Type manually for FormData; browser sets boundary
        // @ts-ignore
        delete authHeaders["Content-Type"]; 

        response = await fetch("/api/mining/jobs", {
          method: "POST",
          headers: authHeaders as HeadersInit,
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to create job");
      }

      const data = await response.json();
      toast.success("Mining job started successfully!");
      
      // Redirect to the job list
      router.push("/mining/jobs");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      console.error(err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/mining/jobs"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Jobs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Mining Job</h1>
        <p className="text-gray-500 mt-1">
          Configure a new automated data extraction task.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        
        {/* Type Selection Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setJobType("url")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              jobType === "url" 
                ? "text-orange-600 border-b-2 border-orange-600 bg-orange-50" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Globe className="h-4 w-4" />
            Website / URL
          </button>
          <button
            type="button"
            onClick={() => setJobType("file")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              jobType === "file" 
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FileText className="h-4 w-4" />
            File Upload (PDF, Excel, Word)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Job Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={jobType === "url" ? "e.g., Pumps Valves Exhibitors" : "e.g., Client List Import"}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none focus:ring-orange-500"
            />
          </div>

          {/* Dynamic Input Section */}
          {jobType === "url" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="url"
                    required
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://www.example.com/exhibitors"
                    className="w-full pl-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none focus:ring-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the listing page URL. Pagination will be handled automatically.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="auto">Auto (Smart Detection)</option>
                  <option value="playwright">Deep Scan (Slower, More Data)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload File <span className="text-red-500">*</span>
                </label>
                
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors relative">
                  <div className="space-y-1 text-center">
                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <FileType className="mx-auto h-12 w-12 text-blue-500" />
                        <div className="flex text-sm text-gray-600 mt-2">
                          <span className="font-medium text-blue-600">{selectedFile.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                          className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setSelectedFile(file);
                              }}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PDF, Word, Excel, CSV up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg flex gap-3">
                <div className="shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">How it works</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    The system will read the file content and automatically extract 
                    email addresses and phone numbers found within the text.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                loading 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : jobType === "url" 
                    ? "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
              }`}
            >
              {loading ? "Starting Job..." : "Start Mining Job"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
