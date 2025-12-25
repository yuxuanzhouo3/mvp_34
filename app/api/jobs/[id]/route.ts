import { type NextRequest, NextResponse } from "next/server"
import { getJob, deleteJob } from "@/lib/job-manager"
import { cancelJob } from "@/lib/job-processor"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jobId = params.id

    const job = getJob(jobId)

    if (!job) {
      return NextResponse.json({ 
        error: "Job not found" 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      job
    })
  } catch (error) {
    console.error("[Job API] Error fetching job:", error)
    return NextResponse.json({ 
      error: "Failed to fetch job",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jobId = params.id

    // Try to cancel the job first if it's running
    cancelJob(jobId)

    // Then delete it
    const deleted = deleteJob(jobId)

    if (!deleted) {
      return NextResponse.json({ 
        error: "Job not found" 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Job deleted successfully"
    })
  } catch (error) {
    console.error("[Job API] Error deleting job:", error)
    return NextResponse.json({ 
      error: "Failed to delete job",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
