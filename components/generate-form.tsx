"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Sparkles, Globe, Smartphone, Monitor, Apple } from "lucide-react"
import { useRouter } from "next/navigation"

const platforms = [
  { id: "android", name: "Android (APK)", icon: Smartphone, stores: ["Google Play", "Chinese Platforms"] },
  { id: "ios", name: "iOS (IPA)", icon: Apple, stores: ["App Store"] },
  { id: "macos", name: "macOS", icon: Monitor, stores: ["Mac App Store"] },
  { id: "windows", name: "Windows", icon: Monitor, stores: ["Microsoft Store"] },
  { id: "linux", name: "Linux", icon: Monitor, stores: ["Direct Distribution"] },
]

export function GenerateForm() {
  const router = useRouter()
  const [inputType, setInputType] = useState<"description" | "url">("description")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [appName, setAppName] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms.map((p) => p.id))
  const [isGenerating, setIsGenerating] = useState(false)

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((id) => id !== platformId) : [...prev, platformId],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: inputType,
          description: inputType === "description" ? description : undefined,
          url: inputType === "url" ? url : undefined,
          appName,
          platforms: selectedPlatforms,
        }),
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard?jobId=${data.jobId}`)
      }
    } catch (error) {
      console.error("Generation failed:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const isFormValid =
    appName.trim() &&
    selectedPlatforms.length > 0 &&
    ((inputType === "description" && description.trim()) || (inputType === "url" && url.trim()))

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="border-border bg-card p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="appName" className="text-base">
              App Name
            </Label>
            <Input
              id="appName"
              placeholder="My Awesome App"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Input Method</Label>
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "description" | "url")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="description" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Describe Your App
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4 space-y-2">
                <Label htmlFor="description">App Description</Label>
                <Textarea
                  id="description"
                  placeholder="A fitness tracking app that helps users log workouts and track progress..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-32 bg-background"
                  required={inputType === "description"}
                />
                <p className="text-sm text-muted-foreground">
                  Describe your app in one or more sentences. Be as detailed as you like.
                </p>
              </TabsContent>

              <TabsContent value="url" className="mt-4 space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-background"
                  required={inputType === "url"}
                />
                <p className="text-sm text-muted-foreground">Provide a website URL to convert into native apps.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <Label className="text-base">Target Platforms</Label>
            <p className="mt-1 text-sm text-muted-foreground">Select which platforms to generate apps for</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {platforms.map((platform) => {
              const Icon = platform.icon
              const isSelected = selectedPlatforms.includes(platform.id)

              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background hover:border-muted-foreground/50"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? "bg-accent/20" : "bg-muted"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? "text-accent" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{platform.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{platform.stores.join(", ")}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!isFormValid || isGenerating} className="gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Apps...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Apps
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
