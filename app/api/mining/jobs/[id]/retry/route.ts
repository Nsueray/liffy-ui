import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/mining/jobs/[id]/retry
 * 
 * Retry a failed or completed mining job
 * Creates a new job with same configuration
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const jobId = id;
  
  try {
    // Get auth token from headers if needed
    const authHeader = request.headers.get("Authorization");
    
    // 1. First, fetch the original job to get its configuration
    const jobResponse = await fetch(
      `${process.env.BACKEND_URL || "http://localhost:3001"}/api/mining/jobs/${jobId}`,
      {
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );
    
    if (!jobResponse.ok) {
      if (jobResponse.status === 404) {
        return NextResponse.json(
          { error: "Mining job not found" },
          { status: 404 }
        );
      }
      throw new Error(`Failed to fetch job: ${jobResponse.status}`);
    }
    
    const originalJob = await jobResponse.json();
    const job = originalJob.job || originalJob;
    
    // 2. Check if job can be retried
    if (job.status === "running" || job.status === "pending") {
      return NextResponse.json(
        { error: "Cannot retry a job that is still running or pending" },
        { status: 400 }
      );
    }
    
    // 3. Create a new job with same configuration
    const retryPayload = {
      name: `${job.name} (Retry)`,
      type: job.type || "url",
      input: job.input,
      strategy: job.strategy || "playwright",
      site_profile: job.site_profile,
      config: job.config || {},
      status: "pending",
      notes: `Retry of job ${jobId}. Original job status: ${job.status}`,
      parent_job_id: jobId, // Reference to original job
    };
    
    // 4. Create the new job
    const createResponse = await fetch(
      `${process.env.BACKEND_URL || "http://localhost:3001"}/api/mining/jobs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(retryPayload),
      }
    );
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to create retry job: ${createResponse.status}`
      );
    }
    
    const newJob = await createResponse.json();
    
    // 5. Optionally, update the original job to mark it as retried
    await fetch(
      `${process.env.BACKEND_URL || "http://localhost:3001"}/api/mining/jobs/${jobId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          retry_job_id: newJob.job?.id || newJob.id,
          notes: `${job.notes || ""}\n[Retried at ${new Date().toISOString()}]`,
        }),
      }
    ).catch((err) => {
      // Non-critical error, just log it
      console.error("Failed to update original job:", err);
    });
    
    // 6. Start the job immediately (optional)
    if (process.env.AUTO_START_RETRY === "true") {
      await fetch(
        `${process.env.BACKEND_URL || "http://localhost:3001"}/api/mining/jobs/${newJob.job?.id || newJob.id}/start`,
        {
          method: "POST",
          headers: authHeader ? { Authorization: authHeader } : {},
        }
      ).catch((err) => {
        console.error("Failed to auto-start job:", err);
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "Mining job retry created successfully",
      original_job_id: jobId,
      new_job_id: newJob.job?.id || newJob.id,
      job: newJob.job || newJob,
    });
    
  } catch (error) {
    console.error("Error retrying mining job:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to retry mining job",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mining/jobs/[id]/retry
 * 
 * Get retry history for a job
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const jobId = id;
  
  try {
    const authHeader = request.headers.get("Authorization");
    
    // Fetch all jobs that are retries of this job
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://localhost:3001"}/api/mining/jobs?parent_job_id=${jobId}`,
      {
        headers: authHeader ? { Authorization: authHeader } : {},
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch retry history: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      original_job_id: jobId,
      retries: data.jobs || [],
      total_retries: data.total || 0,
    });
    
  } catch (error) {
    console.error("Error fetching retry history:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch retry history",
      },
      { status: 500 }
    );
  }
}
