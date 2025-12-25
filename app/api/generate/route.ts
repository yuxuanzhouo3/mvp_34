import { type NextRequest, NextResponse } from "next/server"
import { analyzeURL, validateURL } from "@/lib/url-analyzer"
import { createJob } from "@/lib/job-manager"
import { processJob } from "@/lib/job-processor"
import type { PlatformType } from "@/lib/job-manager"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputType, type, url, description, appName, platforms } = body
    // Support both 'type' and 'inputType' for backwards compatibility
    const actualInputType = inputType || type

    // Validate input
    if (!appName || !platforms || platforms.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (actualInputType === 'url' && !url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    if (actualInputType === 'description' && !description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }

    let metadata = undefined

    // If URL is provided, validate and analyze it
    if (actualInputType === 'url' && url) {
      console.log(`[Generate API] Validating URL: ${url}`)
      
      const validation = await validateURL(url)
      if (!validation.valid) {
        return NextResponse.json({ 
          error: `Invalid URL: ${validation.error}` 
        }, { status: 400 })
      }

      console.log(`[Generate API] Analyzing URL: ${url}`)
      const analysis = await analyzeURL(url)
      
      if (analysis.success && analysis.metadata) {
        metadata = {
          title: analysis.metadata.title,
          description: analysis.metadata.description,
          icon: analysis.metadata.icon,
          primaryColor: analysis.metadata.primaryColor,
          frameworks: analysis.metadata.frameworks
        }
      }
    }

    // Create job
    const job = createJob({
      appName,
      inputType: actualInputType,
      input: actualInputType === 'url' ? url : description,
      platforms: platforms as PlatformType[],
      metadata
    })

    console.log(`[Generate API] Job created: ${job.id}`)

    // Start processing job asynchronously
    processJob(job.id).catch(error => {
      console.error(`[Generate API] Job processing failed: ${job.id}`, error)
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "App generation started",
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        platforms: job.platforms
      }
    })
  } catch (error) {
    console.error("[Generate API] Error creating generation job:", error)
    return NextResponse.json({ 
      error: "Failed to create generation job",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
