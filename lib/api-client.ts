export interface GenerateAppRequest {
  inputType: "description" | "url"
  input: string
  appName: string
  platforms: string[]
  appIcon?: string
}

export interface Build {
  platform: string
  status: "pending" | "queued" | "processing" | "completed" | "failed"
  progress: number
  downloadUrl?: string
  size?: string
  error?: string
}

export interface Job {
  id: string
  appName: string
  inputType: "description" | "url"
  input: string
  platforms: string[]
  appIcon?: string
  status: "queued" | "processing" | "completed" | "failed"
  progress: number
  createdAt: string
  updatedAt: string
  builds: Build[]
}

export async function generateApp(data: GenerateAppRequest) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error("Failed to generate app")
  }

  return response.json()
}

export async function getJobs(): Promise<{ success: boolean; jobs: Job[] }> {
  const response = await fetch("/api/jobs")

  if (!response.ok) {
    throw new Error("Failed to fetch jobs")
  }

  return response.json()
}

export async function getJob(jobId: string): Promise<{ success: boolean; job: Job }> {
  const response = await fetch(`/api/jobs/${jobId}`)

  if (!response.ok) {
    throw new Error("Failed to fetch job")
  }

  return response.json()
}

export async function deleteJob(jobId: string) {
  const response = await fetch(`/api/jobs/${jobId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error("Failed to delete job")
  }

  return response.json()
}
