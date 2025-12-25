import { DashboardContent } from "@/components/dashboard-content"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <Link href="/generate">
              <Button>Generate New App</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Track your app generation jobs and download completed apps
          </p>
        </div>

        <DashboardContent />
      </div>
    </main>
  )
}
