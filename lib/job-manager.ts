/**
 * Job Manager
 * Manages app generation jobs and their lifecycle
 */

export type PlatformType = 'android' | 'ios' | 'macos' | 'windows' | 'linux'
export type JobStatus = 'queued' | 'analyzing' | 'processing' | 'completed' | 'failed'
export type BuildStatus = 'pending' | 'analyzing' | 'building' | 'completed' | 'failed'

export interface Build {
  platform: PlatformType
  status: BuildStatus
  progress: number
  downloadUrl?: string
  size?: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface Job {
  id: string
  appName: string
  inputType: 'description' | 'url'
  input: string
  url?: string
  description?: string
  platforms: PlatformType[]
  status: JobStatus
  progress: number
  createdAt: string
  updatedAt: string
  builds: Build[]
  metadata?: {
    title?: string
    description?: string
    icon?: string
    primaryColor?: string
    frameworks?: string[]
  }
  error?: string
}

// In-memory job storage (replace with database in production)
const jobs = new Map<string, Job>()

/**
 * Creates a new job
 */
export function createJob(data: {
  appName: string
  inputType: 'description' | 'url'
  input: string
  platforms: PlatformType[]
  metadata?: Job['metadata']
}): Job {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const job: Job = {
    id: jobId,
    appName: data.appName,
    inputType: data.inputType,
    input: data.input,
    url: data.inputType === 'url' ? data.input : undefined,
    description: data.inputType === 'description' ? data.input : undefined,
    platforms: data.platforms,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    builds: data.platforms.map((platform) => ({
      platform,
      status: 'pending',
      progress: 0,
    })),
    metadata: data.metadata,
  }

  jobs.set(jobId, job)
  return job
}

/**
 * Gets a job by ID
 */
export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId)
}

/**
 * Gets all jobs
 */
export function getAllJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Updates a job
 */
export function updateJob(jobId: string, updates: Partial<Job>): Job | undefined {
  const job = jobs.get(jobId)
  if (!job) return undefined

  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  jobs.set(jobId, updatedJob)
  return updatedJob
}

/**
 * Updates a specific build within a job
 */
export function updateBuild(
  jobId: string,
  platform: PlatformType,
  updates: Partial<Build>
): Job | undefined {
  const job = jobs.get(jobId)
  if (!job) return undefined

  const buildIndex = job.builds.findIndex((b) => b.platform === platform)
  if (buildIndex === -1) return undefined

  job.builds[buildIndex] = {
    ...job.builds[buildIndex],
    ...updates,
  }

  // Update overall job progress
  const totalProgress = job.builds.reduce((sum, build) => sum + build.progress, 0)
  job.progress = Math.round(totalProgress / job.builds.length)

  // Update job status based on builds
  const allCompleted = job.builds.every((b) => b.status === 'completed')
  const anyFailed = job.builds.some((b) => b.status === 'failed')
  const anyProcessing = job.builds.some((b) => b.status === 'building' || b.status === 'analyzing')

  if (allCompleted) {
    job.status = 'completed'
  } else if (anyFailed && !anyProcessing) {
    job.status = 'failed'
  } else if (anyProcessing) {
    job.status = 'processing'
  }

  job.updatedAt = new Date().toISOString()
  jobs.set(jobId, job)
  
  return job
}

/**
 * Deletes a job
 */
export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

/**
 * Gets jobs by status
 */
export function getJobsByStatus(status: JobStatus): Job[] {
  return Array.from(jobs.values())
    .filter((job) => job.status === status)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

