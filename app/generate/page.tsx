import { GenerateForm } from "@/components/generate-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function GeneratePage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Generate Your App
          </h1>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            Describe your app or provide a website URL. We'll generate native apps for all platforms.
          </p>
        </div>

        <GenerateForm />
      </div>
    </main>
  )
}
