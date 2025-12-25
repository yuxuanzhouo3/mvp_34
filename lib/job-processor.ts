/**
 * Job Processor
 * Processes app generation jobs asynchronously
 */

import { getJob, updateJob, updateBuild } from './job-manager'
import { generateApp } from './app-generator'
import type { PlatformType } from './job-manager'

/**
 * Processes a job by generating apps for all requested platforms
 */
export async function processJob(jobId: string): Promise<void> {
  console.log(`[JobProcessor] Starting job: ${jobId}`)

  const job = getJob(jobId)
  if (!job) {
    console.error(`[JobProcessor] Job not found: ${jobId}`)
    return
  }

  try {
    // Update job status to analyzing
    updateJob(jobId, { status: 'analyzing' })

    // Small delay to simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Update to processing
    updateJob(jobId, { status: 'processing' })

    // Process each platform
    const buildPromises = job.platforms.map(async (platform) => {
      return processPlatformBuild(jobId, platform, job.appName, job.input, job.inputType)
    })

    // Wait for all builds to complete
    await Promise.all(buildPromises)

    console.log(`[JobProcessor] Job completed: ${jobId}`)
  } catch (error) {
    console.error(`[JobProcessor] Job failed: ${jobId}`, error)
    updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Processes a single platform build
 */
async function processPlatformBuild(
  jobId: string,
  platform: PlatformType,
  appName: string,
  input: string | undefined,
  inputType: 'url' | 'description'
): Promise<void> {
  console.log(`[JobProcessor] Building ${platform} for job: ${jobId}`)
  
  // Get the job data to ensure we have the correct input
  const job = getJob(jobId)
  if (!job) {
    console.error(`[JobProcessor] Job not found: ${jobId}`)
    return
  }
  
  // Use input from job if parameter is undefined
  const actualInput = input || job.input

  try {
    // Update build status to analyzing
    updateBuild(jobId, platform, {
      status: 'analyzing',
      progress: 10,
      startedAt: new Date().toISOString()
    })

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      const currentJob = getJob(jobId)
      const currentBuild = currentJob?.builds.find(b => b.platform === platform)
      
      if (currentBuild && currentBuild.progress < 90 && currentBuild.status === 'building') {
        updateBuild(jobId, platform, {
          progress: Math.min(90, currentBuild.progress + Math.random() * 15)
        })
      }
    }, 2000)

    // Start building
    updateBuild(jobId, platform, {
      status: 'building',
      progress: 20
    })

    // Generate the app
    const urlValue = inputType === 'url' ? actualInput : undefined
    const descriptionValue = inputType === 'description' ? actualInput : undefined
    
    const result = await generateApp({
      appName,
      url: urlValue,
      description: descriptionValue,
      platform
    })

    // Clear progress interval
    clearInterval(progressInterval)

    if (result.success) {
      // Update build as completed
      updateBuild(jobId, platform, {
        status: 'completed',
        progress: 100,
        downloadUrl: result.downloadUrl,
        size: result.size,
        completedAt: new Date().toISOString()
      })

      console.log(`[JobProcessor] ${platform} build completed for job: ${jobId}`)
    } else {
      // Update build as failed
      updateBuild(jobId, platform, {
        status: 'failed',
        progress: 0,
        error: result.error || 'Build failed',
        completedAt: new Date().toISOString()
      })

      console.error(`[JobProcessor] ${platform} build failed for job: ${jobId}`, result.error)
    }
  } catch (error) {
    console.error(`[JobProcessor] Error building ${platform} for job: ${jobId}`, error)
    
    updateBuild(jobId, platform, {
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date().toISOString()
    })
  }
}

/**
 * Cancels a job
 */
export function cancelJob(jobId: string): boolean {
  const job = getJob(jobId)
  if (!job) return false

  if (job.status === 'completed' || job.status === 'failed') {
    return false // Can't cancel completed or failed jobs
  }

  updateJob(jobId, {
    status: 'failed',
    error: 'Job cancelled by user'
  })

  return true
}

