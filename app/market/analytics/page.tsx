import { requireMarketAdminSession } from "../require-market-session"
import { MarketAnalyticsDashboardClient } from "./market-analytics-dashboard-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function MarketAnalyticsPage() {
  await requireMarketAdminSession()
  return <MarketAnalyticsDashboardClient />
}

