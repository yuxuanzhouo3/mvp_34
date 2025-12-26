import { Zap, Globe, Download, Shield, Code, Rocket } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Instant Generation",
    description: "Describe your app in one sentence or provide a URL. Our AI handles the rest.",
  },
  {
    icon: Globe,
    title: "Cross-Platform",
    description: "Generate APK, IPA, macOS, Windows, and Linux apps simultaneously.",
  },
  {
    icon: Download,
    title: "Store-Ready",
    description: "Apps are optimized for Google Play, App Store, and all major distribution platforms.",
  },
  {
    icon: Shield,
    title: "Production Quality",
    description: "Enterprise-grade apps with proper signing, permissions, and configurations.",
  },
  {
    icon: Code,
    title: "Full Source Access",
    description: "Download complete source code and customize as needed.",
  },
  {
    icon: Rocket,
    title: "Deploy Anywhere",
    description: "Support for Chinese Android platforms, enterprise stores, and direct distribution.",
  },
]

export function FeaturesSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Everything you need to ship apps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            From concept to app store in minutes. No coding required.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-secondary"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
