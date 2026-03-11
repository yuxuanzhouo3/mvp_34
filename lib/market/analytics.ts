import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { IS_DOMESTIC_VERSION } from "@/config"
import { CloudBaseConnector } from "@/lib/cloudbase/connector"

type DeploymentRegion = "CN" | "INTL"

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured")
  }
  return supabaseAdmin
}

async function fetchCloudBaseAnalyticsEvents(params: {
  startIso: string
  limit: number
  fields: Array<"user_id" | "event_type" | "device_type" | "os" | "browser" | "created_at" | "event_data">
}): Promise<any[]> {
  const connector = new CloudBaseConnector()
  await connector.initialize()
  const db = connector.getClient()
  const _ = db.command

  const fieldPayload: Record<string, boolean> = {}
  for (const f of params.fields) fieldPayload[f] = true

  const res = await db
    .collection("user_analytics")
    .where({
      created_at: _.gte(params.startIso),
      source: "cn",
    })
    .field(fieldPayload)
    .limit(params.limit)
    .get()
    .catch(() => ({ data: [] }))

  return res?.data || []
}

async function getCloudBaseTotalUsers(): Promise<number> {
  try {
    const connector = new CloudBaseConnector()
    await connector.initialize()
    const db = connector.getClient()
    const result = await db.collection("users").count().catch(() => ({ total: 0 }))
    return safeNumber(result?.total)
  } catch {
    return 0
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function toDateKeyFromString(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)))
}

const ACTIVE_EVENT_TYPES = new Set([
  "session_start",
  "page_view",
  "feature_use",
  "build_start",
  "build_complete",
  "build_download",
  "payment",
  "subscription",
])

export type MarketAnalyticsData = {
  region: DeploymentRegion
  generatedAt: string
  rangeDays: number
  overview: {
    totalUsers: number
    newUsersInRange: number
    activeUsersInRange: number
    activeUsers7d: number
    activeUsers30d: number
    activeRate7d: number
    activeRate30d: number
    firstUseRate7dForNewUsers30d: number
    avgUsageEventsPerActiveUser30d: number
    medianFirstUseHours: number
    totalUsageEventsInRange: number
  }
  retention: {
    summary: {
      cohortUsers: number
      d1Rate: number
      d3Rate: number
      d7Rate: number
      d14Rate: number
      d30Rate: number
    }
    cohorts: Array<{
      cohortDate: string
      newUsers: number
      d1Users: number
      d3Users: number
      d7Users: number
      d14Users: number
      d30Users: number
      d1Rate: number
      d3Rate: number
      d7Rate: number
      d14Rate: number
      d30Rate: number
    }>
  }
  trends: Array<{
    date: string
    newUsers: number
    dau: number
    wau: number
    usageEvents: number
    firstUseUsers: number
  }>
  habits: {
    byWeekday: Array<{ label: string; events: number; activeUsers: number; share: number }>
    byHour: Array<{ label: string; events: number; activeUsers: number; share: number }>
    topTools: Array<{ toolId: string; toolName: string; events: number; activeUsers: number; share: number }>
  }
  firstUse: {
    topTools: Array<{ toolId: string; toolName: string; users: number; share: number }>
    latencyDistribution: Array<{ bucket: string; label: string; users: number; share: number }>
  }
  segmentation: {
    recency: Array<{ label: string; users: number; share: number }>
    frequency30d: Array<{ label: string; users: number; share: number }>
  }
  devices: {
    byDeviceType: Record<string, number>
    byOs: Record<string, number>
    byBrowser: Record<string, number>
  }
}

export async function getMarketAdminAnalytics(input?: { days?: number | string }): Promise<MarketAnalyticsData> {
  const days = clampInt(input?.days, 30, 14, 90)
  const region: DeploymentRegion = IS_DOMESTIC_VERSION ? "CN" : "INTL"

  const now = new Date()
  const startRange = new Date(now)
  startRange.setDate(startRange.getDate() - (days - 1))
  const startRangeIso = new Date(
    Date.UTC(startRange.getUTCFullYear(), startRange.getUTCMonth(), startRange.getUTCDate(), 0, 0, 0, 0),
  ).toISOString()

  const start7d = new Date(now)
  start7d.setDate(start7d.getDate() - 6)
  const start7dIso = new Date(
    Date.UTC(start7d.getUTCFullYear(), start7d.getUTCMonth(), start7d.getUTCDate(), 0, 0, 0, 0),
  ).toISOString()

  const start30d = new Date(now)
  start30d.setDate(start30d.getDate() - 29)
  const start30dIso = new Date(
    Date.UTC(start30d.getUTCFullYear(), start30d.getUTCMonth(), start30d.getUTCDate(), 0, 0, 0, 0),
  ).toISOString()

  // For cohort analysis, we need registration events from the last 30 days and activity events from the last 60 days
  const start60d = new Date(now)
  start60d.setDate(start60d.getDate() - 59)
  const start60dIso = new Date(
    Date.UTC(start60d.getUTCFullYear(), start60d.getUTCMonth(), start60d.getUTCDate(), 0, 0, 0, 0),
  ).toISOString()

  let rangeEvents: any[] = []
  let last30Events: any[] = []
  let cohortEvents: any[] = []

  if (IS_DOMESTIC_VERSION) {
    ;[rangeEvents, last30Events, cohortEvents] = await Promise.all([
      fetchCloudBaseAnalyticsEvents({
        startIso: startRangeIso,
        limit: 50000,
        fields: ["user_id", "event_type", "device_type", "os", "browser", "created_at", "event_data"],
      }),
      fetchCloudBaseAnalyticsEvents({
        startIso: start30dIso,
        limit: 50000,
        fields: ["user_id", "event_type", "device_type", "os", "browser", "created_at", "event_data"],
      }),
      fetchCloudBaseAnalyticsEvents({
        startIso: start60dIso,
        limit: 100000,
        fields: ["user_id", "event_type", "created_at"],
      }),
    ])
  } else {
    const supabase = requireSupabaseAdmin()
    const [
      { data: rangeData, error: rangeError },
      { data: last30Data, error: last30Error },
      { data: cohortData, error: cohortError },
    ] = await Promise.all([
      supabase
        .from("user_analytics")
        .select("user_id,event_type,device_type,os,browser,created_at,event_data")
        .gte("created_at", startRangeIso)
        .limit(50000),
      supabase
        .from("user_analytics")
        .select("user_id,event_type,device_type,os,browser,created_at,event_data")
        .gte("created_at", start30dIso)
        .limit(50000),
      supabase.from("user_analytics").select("user_id,event_type,created_at").gte("created_at", start60dIso).limit(100000),
    ])

    if (rangeError) throw new Error(rangeError.message)
    if (last30Error) throw new Error(last30Error.message)
    if (cohortError) throw new Error(cohortError.message)

    rangeEvents = rangeData || []
    last30Events = last30Data || []
    cohortEvents = cohortData || []
  }

  // total users: prefer user_wallets count (cheap), fallback to distinct ids in last30 events
  let totalUsers = 0
  if (IS_DOMESTIC_VERSION) {
    totalUsers = await getCloudBaseTotalUsers()
  } else {
    const supabase = requireSupabaseAdmin()
    try {
      const { count, error } = await supabase.from("user_wallets").select("user_id", { count: "exact", head: true })
      if (!error) totalUsers = safeNumber(count)
    } catch {
      totalUsers = 0
    }
  }
  if (!totalUsers) {
    totalUsers = uniqueStrings((last30Events || []).map((e: any) => e?.user_id)).length
  }

  const newUsersByDate = new Map<string, Set<string>>()
  const dauByDate = new Map<string, Set<string>>()
  const usageEventsByDate = new Map<string, number>()

  const activeUsersInRange = new Set<string>()
  const activeUsers7d = new Set<string>()
  const activeUsers30d = new Set<string>()
  const newUsersInRange = new Set<string>()

  // Track user registration dates and activity days for cohort analysis / first-use analysis
  const userRegistrationDate = new Map<string, string>() // userId -> registration date (YYYY-MM-DD)
  const userRegistrationTs = new Map<string, number>() // userId -> registration timestamp (ms)
  for (const row of cohortEvents || []) {
    const userId = String((row as any)?.user_id || "").trim()
    if (!userId) continue
    const type = String((row as any)?.event_type || "")
    if (type === "register") {
      const createdAt = String((row as any)?.created_at || "")
      const dateKey = toDateKeyFromString(createdAt)
      if (dateKey && !userRegistrationDate.has(userId)) {
        userRegistrationDate.set(userId, dateKey)
        const ts = new Date(createdAt).getTime()
        if (Number.isFinite(ts)) userRegistrationTs.set(userId, ts)
      }
    }
  }

  // Then, collect all activity days from the last 60 days for cohort users
  const userActivityDays = new Map<string, Set<string>>() // userId -> Set of activity dates (YYYY-MM-DD)
  for (const row of cohortEvents || []) {
    const userId = String((row as any)?.user_id || "").trim()
    if (!userId) continue
    const type = String((row as any)?.event_type || "")
    if (ACTIVE_EVENT_TYPES.has(type)) {
      const createdAt = String((row as any)?.created_at || "")
      const dateKey = toDateKeyFromString(createdAt)
      if (dateKey) {
        const activityDays = userActivityDays.get(userId) || new Set<string>()
        activityDays.add(dateKey)
        userActivityDays.set(userId, activityDays)
      }
    }
  }

  let totalEventsInRange = 0
  let sessionStartsInRange = 0

  for (const row of rangeEvents || []) {
    const userId = String((row as any)?.user_id || "").trim()
    if (!userId) continue
    const type = String((row as any)?.event_type || "")
    const createdAt = String((row as any)?.created_at || "")
    const dateKey = toDateKeyFromString(createdAt)
    if (!dateKey) continue

    totalEventsInRange += 1

    if (type === "session_start") {
      sessionStartsInRange += 1
      const set = dauByDate.get(dateKey) || new Set<string>()
      set.add(userId)
      dauByDate.set(dateKey, set)
    }

    if (type === "register") {
      newUsersInRange.add(userId)
      const set = newUsersByDate.get(dateKey) || new Set<string>()
      set.add(userId)
      newUsersByDate.set(dateKey, set)
    }

    if (ACTIVE_EVENT_TYPES.has(type)) {
      activeUsersInRange.add(userId)
    }

    if (type !== "session_end") {
      usageEventsByDate.set(dateKey, (usageEventsByDate.get(dateKey) || 0) + 1)
    }
  }

  const deviceTypeMap: Record<string, number> = {}
  const osMap: Record<string, number> = {}
  const browserMap: Record<string, number> = {}

  const weekdayEvents = Array.from({ length: 7 }, () => 0)
  const weekdayUsers: Array<Set<string>> = Array.from({ length: 7 }, () => new Set<string>())
  const hourEvents = Array.from({ length: 24 }, () => 0)
  const hourUsers: Array<Set<string>> = Array.from({ length: 24 }, () => new Set<string>())

  let usageEvents30d = 0

  for (const row of last30Events || []) {
    const userId = String((row as any)?.user_id || "").trim()
    if (!userId) continue
    const type = String((row as any)?.event_type || "")
    const createdAtStr = String((row as any)?.created_at || "")
    const createdAt = new Date(createdAtStr)
    if (!Number.isFinite(createdAt.getTime())) continue

    if (ACTIVE_EVENT_TYPES.has(type)) {
      activeUsers30d.add(userId)
      usageEvents30d += 1
    }
    if (createdAtStr >= start7dIso && ACTIVE_EVENT_TYPES.has(type)) {
      activeUsers7d.add(userId)
    }

    const deviceType = String((row as any)?.device_type || "unknown") || "unknown"
    const os = String((row as any)?.os || "unknown") || "unknown"
    const browser = String((row as any)?.browser || "unknown") || "unknown"
    deviceTypeMap[deviceType] = (deviceTypeMap[deviceType] || 0) + 1
    osMap[os] = (osMap[os] || 0) + 1
    browserMap[browser] = (browserMap[browser] || 0) + 1

    const weekday = createdAt.getUTCDay()
    weekdayEvents[weekday] += 1
    weekdayUsers[weekday].add(userId)

    const hour = createdAt.getUTCHours()
    hourEvents[hour] += 1
    hourUsers[hour].add(userId)
  }

  // =============================================================================
  // First use (首次使用) - based on first meaningful usage event after registration
  // =============================================================================
  const FIRST_USE_EVENT_TYPES = new Set(["build_start", "build_complete", "build_download", "feature_use"])

  function extractToolFromEvent(type: string, eventData: any): { toolId: string; toolName: string } | null {
    const data = eventData && typeof eventData === "object" ? eventData : null

    // Build events: prefer platform
    if (type.startsWith("build_")) {
      const platform = String((data as any)?.platform || "").trim()
      const toolId = platform || "unknown"
      const nameMap: Record<string, string> = {
        android: "Android",
        ios: "iOS",
        wechat: "微信小程序",
        harmonyos: "HarmonyOS",
        windows: "Windows",
        macos: "macOS",
        linux: "Linux",
        chrome: "Chrome 扩展",
      }
      return { toolId, toolName: nameMap[toolId] || toolId }
    }

    // feature_use: prefer toolId/toolName in eventData
    const toolId = String((data as any)?.toolId || (data as any)?.tool_id || (data as any)?.tool || "").trim() || "unknown"
    const toolName = String((data as any)?.toolName || (data as any)?.tool_name || toolId).trim() || toolId
    return { toolId, toolName }
  }

  const firstUseByUser = new Map<
    string,
    {
      ts: number
      toolId: string
      toolName: string
    }
  >()

  // We only need to scan last30 events: first use for new users is usually within 30 days
  for (const row of last30Events || []) {
    const userId = String((row as any)?.user_id || "").trim()
    if (!userId) continue
    const type = String((row as any)?.event_type || "")
    if (!FIRST_USE_EVENT_TYPES.has(type)) continue

    const createdAtStr = String((row as any)?.created_at || "")
    const ts = new Date(createdAtStr).getTime()
    if (!Number.isFinite(ts)) continue

    const regTs = userRegistrationTs.get(userId)
    if (!regTs) continue
    if (ts < regTs) continue

    const tool = extractToolFromEvent(type, (row as any)?.event_data)
    if (!tool) continue

    const existing = firstUseByUser.get(userId)
    if (!existing || ts < existing.ts) {
      firstUseByUser.set(userId, { ts, ...tool })
    }
  }

  const firstUseUsers = Array.from(firstUseByUser.entries()).map(([userId, info]) => ({ userId, ...info }))
  const firstUseUserCount = firstUseUsers.length

  // Top tools by first-use users
  const toolAgg = new Map<string, { toolId: string; toolName: string; users: number }>()
  for (const item of firstUseUsers) {
    const key = item.toolId
    const current = toolAgg.get(key) || { toolId: item.toolId, toolName: item.toolName, users: 0 }
    current.users += 1
    toolAgg.set(key, current)
  }

  const firstUseTopTools = Array.from(toolAgg.values())
    .sort((a, b) => b.users - a.users)
    .slice(0, 10)
    .map((row) => ({
      toolId: row.toolId,
      toolName: row.toolName,
      users: row.users,
      share: firstUseUserCount > 0 ? Number(((row.users / firstUseUserCount) * 100).toFixed(2)) : 0,
    }))

  // Latency distribution (register -> first use)
  const latencyHours: number[] = []
  for (const item of firstUseUsers) {
    const regTs = userRegistrationTs.get(item.userId)
    if (!regTs) continue
    const hours = (item.ts - regTs) / (1000 * 60 * 60)
    if (Number.isFinite(hours) && hours >= 0) latencyHours.push(hours)
  }
  latencyHours.sort((a, b) => a - b)

  function median(values: number[]) {
    if (values.length === 0) return 0
    const mid = Math.floor(values.length / 2)
    if (values.length % 2 === 1) return values[mid]
    return (values[mid - 1] + values[mid]) / 2
  }

  const medianFirstUseHours = Number(median(latencyHours).toFixed(2))

  const latencyBuckets: Array<{ bucket: string; label: string; test: (h: number) => boolean }> = [
    { bucket: "<1h", label: "小于 1 小时", test: (h) => h < 1 },
    { bucket: "1-6h", label: "1-6 小时", test: (h) => h >= 1 && h < 6 },
    { bucket: "6-24h", label: "6-24 小时", test: (h) => h >= 6 && h < 24 },
    { bucket: "1-3d", label: "1-3 天", test: (h) => h >= 24 && h < 72 },
    { bucket: "3-7d", label: "3-7 天", test: (h) => h >= 72 && h < 168 },
    { bucket: "7d+", label: "7 天以上", test: (h) => h >= 168 },
  ]

  const latencyDistribution = latencyBuckets.map((b) => {
    const users = latencyHours.filter(b.test).length
    return {
      bucket: b.bucket,
      label: b.label,
      users,
      share: latencyHours.length > 0 ? Number(((users / latencyHours.length) * 100).toFixed(2)) : 0,
    }
  })

  // First-use rate: new users in last 30 days who used within 7 days
  const newUsers30d = uniqueStrings(Array.from(userRegistrationTs.keys()))
  let firstUseWithin7d = 0
  for (const userId of newUsers30d) {
    const regTs = userRegistrationTs.get(userId)
    const first = firstUseByUser.get(userId)
    if (!regTs || !first) continue
    if (first.ts - regTs <= 7 * 24 * 60 * 60 * 1000) firstUseWithin7d += 1
  }
  const firstUseRate7dForNewUsers30d =
    newUsers30d.length > 0 ? Number(((firstUseWithin7d / newUsers30d.length) * 100).toFixed(2)) : 0

  // Build trend buckets for the selected range
  const trends: MarketAnalyticsData["trends"] = []
  const cursor = new Date(startRangeIso)
  for (let i = 0; i < days; i += 1) {
    const key = cursor.toISOString().slice(0, 10)
    trends.push({
      date: key,
      newUsers: newUsersByDate.get(key)?.size || 0,
      dau: dauByDate.get(key)?.size || 0,
      wau: 0,
      usageEvents: usageEventsByDate.get(key) || 0,
      firstUseUsers: 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const activeRate7d = totalUsers > 0 ? Number(((activeUsers7d.size / totalUsers) * 100).toFixed(2)) : 0
  const activeRate30d = totalUsers > 0 ? Number(((activeUsers30d.size / totalUsers) * 100).toFixed(2)) : 0
  const avgUsageEventsPerActiveUser30d =
    activeUsers30d.size > 0 ? Number((usageEvents30d / activeUsers30d.size).toFixed(2)) : 0

  const totalEvents30d = weekdayEvents.reduce((acc, v) => acc + v, 0)
  const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

  const byWeekday = weekdayEvents.map((events, index) => {
    const activeUsers = weekdayUsers[index].size
    const share = totalEvents30d > 0 ? Number(((events / totalEvents30d) * 100).toFixed(2)) : 0
    return { label: weekdayLabels[index], events, activeUsers, share }
  })

  const byHour = hourEvents.map((events, index) => {
    const activeUsers = hourUsers[index].size
    const share = totalEvents30d > 0 ? Number(((events / totalEvents30d) * 100).toFixed(2)) : 0
    const label = `${index.toString().padStart(2, "0")}:00`
    return { label, events, activeUsers, share }
  })

  // Calculate Cohort Retention
  const cohortMap = new Map<
    string,
    {
      newUsers: number
      d1Users: number
      d3Users: number
      d7Users: number
      d14Users: number
      d30Users: number
    }
  >()

  const nowUtc = new Date()
  const todayUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate()))
  const cohortWindowStart = new Date(todayUtc)
  cohortWindowStart.setUTCDate(cohortWindowStart.getUTCDate() - Math.min(29, days - 1))

  function addUtcDays(date: Date, days: number): Date {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + days)
    return next
  }

  function toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10)
  }

  function toRate(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0
    return Number(((numerator / denominator) * 100).toFixed(2))
  }

  // Process all users with registration dates
  for (const [userId, regDateKey] of userRegistrationDate.entries()) {
    const regDate = new Date(regDateKey + "T00:00:00.000Z")
    if (!Number.isFinite(regDate.getTime())) continue

    // Only include cohorts within the window
    if (regDate.getTime() < cohortWindowStart.getTime() || regDate.getTime() > todayUtc.getTime()) continue

    const cohort = cohortMap.get(regDateKey) || {
      newUsers: 0,
      d1Users: 0,
      d3Users: 0,
      d7Users: 0,
      d14Users: 0,
      d30Users: 0,
    }
    cohort.newUsers += 1

    const activityDays = userActivityDays.get(userId) || new Set<string>()

    // Check retention on specific days after registration
    const d1Date = addUtcDays(regDate, 1)
    const d3Date = addUtcDays(regDate, 3)
    const d7Date = addUtcDays(regDate, 7)
    const d14Date = addUtcDays(regDate, 14)
    const d30Date = addUtcDays(regDate, 30)

    if (activityDays.has(toDateKey(d1Date))) cohort.d1Users += 1
    if (activityDays.has(toDateKey(d3Date))) cohort.d3Users += 1
    if (activityDays.has(toDateKey(d7Date))) cohort.d7Users += 1
    if (activityDays.has(toDateKey(d14Date))) cohort.d14Users += 1
    if (activityDays.has(toDateKey(d30Date))) cohort.d30Users += 1

    cohortMap.set(regDateKey, cohort)
  }

  // Build cohorts array with rates
  const cohorts = Array.from(cohortMap.entries())
    .map(([cohortDate, value]) => ({
      cohortDate,
      newUsers: value.newUsers,
      d1Users: value.d1Users,
      d3Users: value.d3Users,
      d7Users: value.d7Users,
      d14Users: value.d14Users,
      d30Users: value.d30Users,
      d1Rate: toRate(value.d1Users, value.newUsers),
      d3Rate: toRate(value.d3Users, value.newUsers),
      d7Rate: toRate(value.d7Users, value.newUsers),
      d14Rate: toRate(value.d14Users, value.newUsers),
      d30Rate: toRate(value.d30Users, value.newUsers),
    }))
    .sort((a, b) => (a.cohortDate < b.cohortDate ? 1 : -1))

  // Calculate summary retention rates
  const retentionTotals = cohorts.reduce(
    (acc, row) => {
      acc.newUsers += row.newUsers
      acc.d1Users += row.d1Users
      acc.d3Users += row.d3Users
      acc.d7Users += row.d7Users
      acc.d14Users += row.d14Users
      acc.d30Users += row.d30Users
      return acc
    },
    { newUsers: 0, d1Users: 0, d3Users: 0, d7Users: 0, d14Users: 0, d30Users: 0 },
  )

  const retentionSummary = {
    cohortUsers: retentionTotals.newUsers,
    d1Rate: toRate(retentionTotals.d1Users, retentionTotals.newUsers),
    d3Rate: toRate(retentionTotals.d3Users, retentionTotals.newUsers),
    d7Rate: toRate(retentionTotals.d7Users, retentionTotals.newUsers),
    d14Rate: toRate(retentionTotals.d14Users, retentionTotals.newUsers),
    d30Rate: toRate(retentionTotals.d30Users, retentionTotals.newUsers),
  }

  return {
    region,
    generatedAt: new Date().toISOString(),
    rangeDays: days,
    overview: {
      totalUsers,
      newUsersInRange: newUsersInRange.size,
      activeUsersInRange: activeUsersInRange.size,
      activeUsers7d: activeUsers7d.size,
      activeUsers30d: activeUsers30d.size,
      activeRate7d,
      activeRate30d,
      firstUseRate7dForNewUsers30d,
      avgUsageEventsPerActiveUser30d,
      medianFirstUseHours,
      totalUsageEventsInRange: totalEventsInRange,
    },
    retention: {
      summary: retentionSummary,
      cohorts,
    },
    trends,
    habits: {
      byWeekday,
      byHour,
      topTools: [],
    },
    firstUse: {
      topTools: firstUseTopTools,
      latencyDistribution,
    },
    segmentation: {
      recency: [],
      frequency30d: [],
    },
    devices: {
      byDeviceType: deviceTypeMap,
      byOs: osMap,
      byBrowser: browserMap,
    },
  }
}

