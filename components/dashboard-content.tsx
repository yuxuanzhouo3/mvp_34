"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, Download, CheckCircle2, Clock, XCircle, Smartphone, Apple, Monitor } from "lucide-react"

interface Build {
  platform: string
  status: "pending" | "analyzing" | "building" | "completed" | "failed"
  progress: number
  downloadUrl?: string
  size?: string
  error?: string
}

interface Job {
  id: string
  appName: string
  inputType: "description" | "url"
  input: string
  url?: string
  description?: string
  platforms: string[]
  status: "queued" | "analyzing" | "processing" | "completed" | "failed"
  progress: number
  createdAt: string
  updatedAt: string
  builds: Build[]
  metadata?: {
    title?: string
    description?: string
    icon?: string
    primaryColor?: string
  }
  error?: string
}

const platformIcons: Record<string, any> = {
  android: Smartphone,
  ios: Apple,
  macos: Monitor,
  windows: Monitor,
  linux: Monitor,
}

const platformLabels: Record<string, string> = {
  android: "Android APK",
  ios: "iOS IPA",
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
}

export function DashboardContent() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId")
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [jobId])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error("Failed to fetch jobs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "processing":
      case "analyzing":
        return <Loader2 className="h-5 w-5 animate-spin text-accent" />
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: Job["status"]) => {
    const variants: Record<Job["status"], "default" | "secondary" | "destructive" | "outline"> = {
      queued: "secondary",
      analyzing: "default",
      processing: "default",
      completed: "default",
      failed: "destructive",
    }

    return (
      <Badge variant={variants[status]} className={status === "completed" ? "bg-green-500/10 text-green-500" : ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getBuildStatusIcon = (status: Build["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "building":
      case "analyzing":
        return <Loader2 className="h-4 w-4 animate-spin text-accent" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card className="border-border bg-card p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-foreground">No apps generated yet</h3>
          <p className="mt-2 text-muted-foreground">Start by generating your first app</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {jobs.map((job) => (
        <Card key={job.id} className="border-border bg-card p-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <h3 className="text-xl font-semibold text-foreground">{job.appName}</h3>
                  {getStatusBadge(job.status)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {job.inputType === "description" ? "Description: " : "URL: "}
                  <span className="text-foreground">{job.input}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Created {new Date(job.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {(job.status === "processing" || job.status === "analyzing") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {job.status === "analyzing" ? "Analyzing..." : "Generating apps..."}
                  </span>
                  <span className="font-medium text-foreground">{Math.round(job.progress)}%</span>
                </div>
                <Progress value={job.progress} className="h-2" />
              </div>
            )}

            {/* Platform builds with individual status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Platform Builds</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {job.builds.map((build) => {
                  const Icon = platformIcons[build.platform]
                  const isCompleted = build.status === "completed"
                  const isFailed = build.status === "failed"
                  const isProcessing = build.status === "building" || build.status === "analyzing"

                  return (
                    <div
                      key={build.platform}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        isCompleted ? "border-green-500/30 bg-green-500/5" :
                        isFailed ? "border-destructive/30 bg-destructive/5" :
                        "border-border bg-background"
                      }`}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{platformLabels[build.platform]}</span>
                          {getBuildStatusIcon(build.status)}
                        </div>
                        {isProcessing && (
                          <div className="mt-1">
                            <Progress value={build.progress} className="h-1" />
                            <p className="mt-0.5 text-xs text-muted-foreground">{Math.round(build.progress)}%</p>
                          </div>
                        )}
                        {isCompleted && build.size && (
                          <p className="text-xs text-muted-foreground">{build.size}</p>
                        )}
                        {isFailed && build.error && (
                          <p className="text-xs text-destructive">{build.error}</p>
                        )}
                      </div>
                      {isCompleted && build.downloadUrl && (
                        <Button size="sm" variant="ghost" className="shrink-0" asChild>
                          <a href={build.downloadUrl} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {job.status === "failed" && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">Generation Failed</p>
                {job.error && (
                  <p className="mt-1 text-xs text-destructive/80">{job.error}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Please try again or contact support if the issue persists.
                </p>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
