import { Apple, Smartphone, Monitor, Package } from "lucide-react"

const stats = [
  {
    value: "5",
    label: "platforms",
    description: "One click deployment",
    icon: Package,
  },
  {
    value: "< 5min",
    label: "generation time",
    description: "Lightning fast builds",
    icon: Smartphone,
  },
  {
    value: "100%",
    label: "native apps",
    description: "Full platform support",
    icon: Apple,
  },
  {
    value: "∞",
    label: "possibilities",
    description: "Any app, any platform",
    icon: Monitor,
  },
]

export function StatsSection() {
  return (
    <section className="border-b border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-secondary"
              >
                <Icon className="h-8 w-8 text-accent" />
                <div>
                  <div className="text-4xl font-bold text-foreground">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{stat.description}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
