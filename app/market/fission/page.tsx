import { MarketDashboardClient } from "../market-dashboard-client"
import { requireMarketAdminSession } from "../require-market-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function MarketFissionPage() {
  await requireMarketAdminSession()
  return <MarketDashboardClient />
}

