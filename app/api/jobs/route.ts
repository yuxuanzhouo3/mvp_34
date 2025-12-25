import { type NextRequest, NextResponse } from "next/server"
import { getAllJobs } from "@/lib/job-manager"

export async function GET(request: NextRequest) {
  try {
    // Get all jobs from job manager
    const jobs = getAllJobs()

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length
    })
  } catch (error) {
    console.error("[Jobs API] Error fetching jobs:", error)
    return NextResponse.json({ 
      error: "Failed to fetch jobs",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
