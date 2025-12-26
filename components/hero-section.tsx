import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-background to-background" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>AI-Powered App Generation</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-7xl text-balance">
            Generate apps for any platform in <span className="text-accent">seconds</span>
          </h1>

          <p className="mb-10 text-lg leading-relaxed text-muted-foreground sm:text-xl text-balance">
            Transform your idea or website into native apps for iOS, Android, macOS, Windows, and Linux. One input, five
            platforms. Deploy to all major app stores instantly.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/generate">
              <Button size="lg" className="group gap-2 text-base">
                Start Generating
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="text-base bg-transparent">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
