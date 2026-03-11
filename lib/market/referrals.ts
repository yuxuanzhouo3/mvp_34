import { IS_DOMESTIC_VERSION } from "@/config"
import { CloudBaseConnector } from "@/lib/cloudbase/connector"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

function requireSupabaseAdmin() {
  // 邀请裂变运营看板目前只支持国际版（Supabase）
  // 国内版（CloudBase）暂时不接入这里的数据，直接在上层返回占位数据即可
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured")
  }
  return supabaseAdmin
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parsePage(value: number | string | undefined, fallback = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function parseLimit(value: number | string | undefined, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(max, Math.floor(parsed))
}

function toIsoDateKey(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw) return null

  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function normalizeSource(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32)
}

function normalizeUserId(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 128)
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)))
}

async function loadAuthEmailsByUserIds(userIds: Array<string | null | undefined>) {
  const supabase = requireSupabaseAdmin()
  const ids = uniqueStrings(userIds)
  const map = new Map<string, string | null>()
  if (ids.length === 0) return map

  // Use auth admin API (avoid relying on a non-existent public `users` table)
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id)
        if (error) return [id, null] as const
        return [id, data?.user?.email ?? null] as const
      } catch {
        return [id, null] as const
      }
    }),
  )

  for (const [id, email] of results) {
    map.set(id, email)
  }
  return map
}

function createDateBuckets(days: number) {
  const buckets: Array<{ date: string; clicks: number; invites: number; activated: number; rewardDays: number }> = []
  const map = new Map<string, typeof buckets[0]>()

  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const key = date.toISOString().slice(0, 10)
    const bucket = { date: key, clicks: 0, invites: 0, activated: 0, rewardDays: 0 }
    buckets.push(bucket)
    map.set(key, bucket)
  }

  return { buckets, map }
}

export interface MarketOverviewData {
  totalClicks: number
  totalInvites: number
  totalActivated: number
  totalRewardDays: number
  signupRewardDays: number
  conversionRate: number
  activationRate: number
  usersWithReferralCode: number
}

export interface MarketTrendPoint {
  date: string
  clicks: number
  invites: number
  activated: number
  rewardDays: number
}

export interface MarketChannelPoint {
  source: string
  clicks: number
  invites: number
  conversionRate: number
}

export interface MarketTopInviterPoint {
  inviterUserId: string
  inviterEmail: string | null
  referralCode: string | null
  clickCount: number
  invitedCount: number
  activatedCount: number
  rewardDays: number
}

export interface MarketRelationRow {
  relationId: string
  inviterUserId: string
  inviterEmail: string | null
  invitedUserId: string
  invitedEmail: string | null
  shareCode: string
  toolSlug: string | null
  firstToolId: string | null
  status: string
  createdAt: string
  activatedAt: string | null
}

export interface MarketRewardRow {
  rewardId: string
  relationId: string | null
  userId: string
  userEmail: string | null
  rewardType: string
  amount: number
  status: string
  referenceId: string
  createdAt: string
  grantedAt: string | null
}

export interface MarketListResult<T> {
  rows: T[]
  total: number
  page: number
  limit: number
}

export async function getMarketAdminOverview(): Promise<MarketOverviewData> {
  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：使用 CloudBase 统计 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      const [relationsRes, clicksRes, activatedRes, rewardsRes, linksRes] = await Promise.all([
        db.collection("referral_relations").count(),
        db.collection("referral_clicks").count(),
        db.collection("referral_relations").where({ status: "activated" }).count(),
        db.collection("referral_rewards").where({ status: "granted" }).get(),
        db.collection("referral_links").count(),
      ])

      const totalInvites = safeNumber(relationsRes.total)
      const totalClicks = safeNumber(clicksRes.total)
      const totalActivated = safeNumber(activatedRes.total)
      const usersWithReferralCode = safeNumber(linksRes.total)

      let totalRewardDays = 0
      let signupRewardDays = 0
      for (const row of rewardsRes.data || []) {
        const amount = safeNumber((row as any)?.amount)
        totalRewardDays += amount
        const rewardType = String((row as any)?.reward_type || "").toLowerCase()
        if (rewardType.includes("signup") || rewardType.includes("注册")) {
          signupRewardDays += amount
        }
      }

      const conversionRate = totalClicks > 0 ? Number(((totalInvites / totalClicks) * 100).toFixed(2)) : 0
      const activationRate = totalInvites > 0 ? Number(((totalActivated / totalInvites) * 100).toFixed(2)) : 0

      return {
        totalClicks,
        totalInvites,
        totalActivated,
        totalRewardDays,
        signupRewardDays,
        conversionRate,
        activationRate,
        usersWithReferralCode,
      }
    } catch (error) {
      console.error("[Market Overview CN] CloudBase error, fallback to zero metrics:", error)
      // 出错时回退为 0，避免后端 500 影响页面
      return {
        totalClicks: 0,
        totalInvites: 0,
        totalActivated: 0,
        totalRewardDays: 0,
        signupRewardDays: 0,
        conversionRate: 0,
        activationRate: 0,
        usersWithReferralCode: 0,
      }
    }
  }

  // ================== 国际版：Supabase ==================
  try {
    const supabase = requireSupabaseAdmin()

    const [relationCountResult, clickCountResult, activatedCountResult, linksResult, rewardsResult] =
      await Promise.all([
        supabase.from("referral_relations").select("id", { count: "exact", head: true }),
        supabase.from("referral_clicks").select("id", { count: "exact", head: true }),
        supabase.from("referral_relations").select("id", { count: "exact", head: true }).not("activated_at", "is", null),
        supabase.from("referral_links").select("creator_user_id", { count: "exact", head: true }),
        supabase.from("referral_rewards").select("amount,reward_type").eq("status", "granted"),
      ])

      const hasError =
        relationCountResult.error ||
        clickCountResult.error ||
        activatedCountResult.error ||
        linksResult.error ||
        rewardsResult.error

      if (hasError) {
        const errorMessages = [
          relationCountResult.error?.message,
          clickCountResult.error?.message,
          activatedCountResult.error?.message,
          linksResult.error?.message,
          rewardsResult.error?.message,
        ]
          .filter(Boolean)
          .join("; ")

        const isTableMissing =
          errorMessages.toLowerCase().includes("could not find the table") ||
          (errorMessages.toLowerCase().includes("relation") && errorMessages.toLowerCase().includes("does not exist")) ||
          errorMessages.toLowerCase().includes("schema cache")

        if (isTableMissing) {
          console.warn("[Market Overview] Tables not found, returning zero data. Please run migrations:", errorMessages)
          return {
            totalClicks: 0,
            totalInvites: 0,
            totalActivated: 0,
            totalRewardDays: 0,
            signupRewardDays: 0,
            conversionRate: 0,
            activationRate: 0,
            usersWithReferralCode: 0,
          }
        }

        throw new Error(errorMessages)
      }

      const totalInvites = safeNumber(relationCountResult.count)
      const totalClicks = safeNumber(clickCountResult.count)
      const totalActivated = safeNumber(activatedCountResult.count)
      const usersWithReferralCode = safeNumber(linksResult.count)

      let totalRewardDays = 0
      let signupRewardDays = 0

      for (const row of rewardsResult.data || []) {
        const amount = safeNumber((row as any)?.amount)
        totalRewardDays += amount
        const rewardType = String((row as any)?.reward_type || "").toLowerCase()
        if (rewardType.includes("signup") || rewardType.includes("注册")) {
          signupRewardDays += amount
        }
      }

      const conversionRate = totalClicks > 0 ? Number(((totalInvites / totalClicks) * 100).toFixed(2)) : 0
      const activationRate = totalInvites > 0 ? Number(((totalActivated / totalInvites) * 100).toFixed(2)) : 0

      return {
        totalClicks,
        totalInvites,
        totalActivated,
        totalRewardDays,
        signupRewardDays,
        conversionRate,
        activationRate,
        usersWithReferralCode,
      }
  } catch (error: any) {
    console.error("[Market Overview] Error:", error)
    throw new Error(error?.message || "Failed to load market overview")
  }
}

export async function getMarketAdminTrends(input?: { days?: number | string }): Promise<MarketTrendPoint[]> {
  const days = parseLimit(input?.days, 14, 90)
  const { buckets, map } = createDateBuckets(days)
  const startDate = buckets[0]?.date ? `${buckets[0].date}T00:00:00.000Z` : new Date().toISOString()

  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：CloudBase 统计每日趋势 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      const cmd = db.command
      const [clicksRes, invitesRes, activatedRes, rewardsRes] = await Promise.all([
        db.collection("referral_clicks").where({ created_at: cmd.gte(startDate) }).get(),
        db.collection("referral_relations").where({ created_at: cmd.gte(startDate) }).get(),
        db.collection("referral_relations").where({ status: "activated", activated_at: cmd.gte(startDate) }).get(),
        db.collection("referral_rewards").where({ status: "granted", created_at: cmd.gte(startDate) }).get(),
      ])

      for (const row of clicksRes.data || []) {
        const key = toIsoDateKey((row as any)?.created_at)
        const bucket = key ? map.get(key) : null
        if (bucket) bucket.clicks += 1
      }

      for (const row of invitesRes.data || []) {
        const key = toIsoDateKey((row as any)?.created_at)
        const bucket = key ? map.get(key) : null
        if (bucket) bucket.invites += 1
      }

      for (const row of activatedRes.data || []) {
        const key = toIsoDateKey((row as any)?.activated_at)
        const bucket = key ? map.get(key) : null
        if (bucket) bucket.activated += 1
      }

      for (const row of rewardsRes.data || []) {
        const key = toIsoDateKey((row as any)?.created_at)
        const bucket = key ? map.get(key) : null
        if (bucket) bucket.rewardDays += safeNumber((row as any)?.amount)
      }

      return buckets
    } catch (error) {
      console.error("[Market Trends CN] CloudBase error, return empty buckets:", error)
      return buckets
    }
  }

  // ================== 国际版：Supabase ==================
  const supabase = requireSupabaseAdmin()

  const [clicksResult, invitesResult, activatedResult, rewardsResult] = await Promise.all([
    supabase.from("referral_clicks").select("created_at").gte("created_at", startDate),
    supabase.from("referral_relations").select("created_at").gte("created_at", startDate),
    supabase
      .from("referral_relations")
      .select("activated_at")
      .not("activated_at", "is", null)
      .gte("activated_at", startDate),
    supabase.from("referral_rewards").select("created_at,amount").eq("status", "granted").gte("created_at", startDate),
  ])

  if (clicksResult.error) throw new Error(clicksResult.error.message)
  if (invitesResult.error) throw new Error(invitesResult.error.message)
  if (activatedResult.error) throw new Error(activatedResult.error.message)
  if (rewardsResult.error) throw new Error(rewardsResult.error.message)

  for (const row of clicksResult.data || []) {
    const key = toIsoDateKey((row as any)?.created_at)
    const bucket = key ? map.get(key) : null
    if (bucket) bucket.clicks += 1
  }

  for (const row of invitesResult.data || []) {
    const key = toIsoDateKey((row as any)?.created_at)
    const bucket = key ? map.get(key) : null
    if (bucket) bucket.invites += 1
  }

  for (const row of activatedResult.data || []) {
    const key = toIsoDateKey((row as any)?.activated_at)
    const bucket = key ? map.get(key) : null
    if (bucket) bucket.activated += 1
  }

  for (const row of rewardsResult.data || []) {
    const key = toIsoDateKey((row as any)?.created_at)
    const bucket = key ? map.get(key) : null
    if (bucket) bucket.rewardDays += safeNumber((row as any)?.amount)
  }

  return buckets
}

export async function getMarketAdminChannels(input?: { limit?: number | string }): Promise<MarketChannelPoint[]> {
  const limit = parseLimit(input?.limit, 12, 50)
  const bySource = new Map<string, { clicks: number; invites: number }>()

  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：CloudBase 渠道占比 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      const res = await db.collection("referral_clicks").get()

      for (const row of res.data || []) {
        const source = normalizeSource((row as any)?.source) || "unknown"
        const current = bySource.get(source) || { clicks: 0, invites: 0 }
        current.clicks += 1
        if ((row as any)?.registered_user_id) {
          current.invites += 1
        }
        bySource.set(source, current)
      }
    } catch (error) {
      console.error("[Market Channels CN] CloudBase error, return empty list:", error)
      return []
    }
  } else {
    // ================== 国际版：Supabase ==================
    const supabase = requireSupabaseAdmin()
    const { data, error } = await supabase.from("referral_clicks").select("source,registered_user_id")

    if (error) throw new Error(error.message)

    for (const row of data || []) {
      const source = normalizeSource((row as any)?.source) || "unknown"
      const current = bySource.get(source) || { clicks: 0, invites: 0 }
      current.clicks += 1
      if ((row as any)?.registered_user_id) {
        current.invites += 1
      }
      bySource.set(source, current)
    }
  }

  return Array.from(bySource.entries())
    .map(([source, metrics]) => ({
      source,
      clicks: metrics.clicks,
      invites: metrics.invites,
      conversionRate: metrics.clicks > 0 ? Number(((metrics.invites / metrics.clicks) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => (b.clicks === a.clicks ? b.invites - a.invites : b.clicks - a.clicks))
    .slice(0, limit)
}

export async function getMarketAdminTopInviters(input?: { limit?: number | string }): Promise<MarketTopInviterPoint[]> {
  const limit = parseLimit(input?.limit, 20, 100)

  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：CloudBase Top 邀请人 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      // 1) 汇总邀请关系
      const relationsRes = await db.collection("referral_relations").get()
      const metricsByInviter = new Map<
        string,
        { invitedCount: number; activatedCount: number; rewardDays: number; clickCount: number }
      >()

      for (const row of relationsRes.data || []) {
        const inviterUserId = normalizeUserId((row as any)?.inviter_user_id)
        if (!inviterUserId) continue
        const current = metricsByInviter.get(inviterUserId) || {
          invitedCount: 0,
          activatedCount: 0,
          rewardDays: 0,
          clickCount: 0,
        }
        current.invitedCount += 1
        if ((row as any)?.status === "activated" || (row as any)?.activated_at) {
          current.activatedCount += 1
        }
        metricsByInviter.set(inviterUserId, current)
      }

      const sortedInviterIds = Array.from(metricsByInviter.entries())
        .sort((a, b) =>
          b[1].invitedCount === a[1].invitedCount
            ? b[1].activatedCount - a[1].activatedCount
            : b[1].invitedCount - a[1].invitedCount,
        )
        .slice(0, limit)
        .map(([inviterUserId]) => inviterUserId)

      if (sortedInviterIds.length === 0) return []

      // 2) 奖励统计
      const rewardsRes = await db
        .collection("referral_rewards")
        .where({ status: "granted" })
        .get()

      for (const row of rewardsRes.data || []) {
        const userId = normalizeUserId((row as any)?.user_id)
        if (!userId) continue
        const metrics = metricsByInviter.get(userId)
        if (metrics) metrics.rewardDays += safeNumber((row as any)?.amount)
      }

      // 3) 点击统计（通过 referral_links + referral_clicks）
      const linksRes = await db
        .collection("referral_links")
        .where({ creator_user_id: db.command.in(sortedInviterIds) })
        .get()

      const referralCodeByUserId = new Map<string, string | null>()
      for (const link of linksRes.data || []) {
        const uid = String((link as any)?.creator_user_id || "").trim()
        const code = String((link as any)?.share_code || "").trim()
        if (uid) referralCodeByUserId.set(uid, code || null)
      }

      const codes = uniqueStrings(Array.from(referralCodeByUserId.values()))
      if (codes.length > 0) {
        const clicksRes = await db
          .collection("referral_clicks")
          .where({ share_code: db.command.in(codes) })
          .get()

        const clickByCode = new Map<string, number>()
        for (const row of clicksRes.data || []) {
          const code = String((row as any)?.share_code || "").trim()
          if (!code) continue
          clickByCode.set(code, (clickByCode.get(code) || 0) + 1)
        }

        for (const [userId, code] of referralCodeByUserId.entries()) {
          if (!code) continue
          const metrics = metricsByInviter.get(userId)
          if (metrics) metrics.clickCount = clickByCode.get(code) || 0
        }
      }

      // 4) 暂时国内版不显示邮箱（CloudBase 没有 auth.admin），只展示 userId 和指标
      return sortedInviterIds.map((inviterUserId) => {
        const metrics = metricsByInviter.get(inviterUserId) || {
          invitedCount: 0,
          activatedCount: 0,
          rewardDays: 0,
          clickCount: 0,
        }

        return {
          inviterUserId,
          inviterEmail: null,
          referralCode: referralCodeByUserId.get(inviterUserId) || null,
          clickCount: metrics.clickCount,
          invitedCount: metrics.invitedCount,
          activatedCount: metrics.activatedCount,
          rewardDays: metrics.rewardDays,
        }
      })
    } catch (error) {
      console.error("[Market TopInviters CN] CloudBase error, return empty list:", error)
      return []
    }
  }

  const supabase = requireSupabaseAdmin()

  const { data: relationRows, error: relationError } = await supabase
    .from("referral_relations")
    .select("inviter_user_id,activated_at")

  if (relationError) throw new Error(relationError.message)

  const metricsByInviter = new Map<
    string,
    { invitedCount: number; activatedCount: number; rewardDays: number; clickCount: number }
  >()

  for (const row of relationRows || []) {
    const inviterUserId = normalizeUserId((row as any)?.inviter_user_id)
    if (!inviterUserId) continue
    const current = metricsByInviter.get(inviterUserId) || {
      invitedCount: 0,
      activatedCount: 0,
      rewardDays: 0,
      clickCount: 0,
    }
    current.invitedCount += 1
    if ((row as any)?.activated_at) {
      current.activatedCount += 1
    }
    metricsByInviter.set(inviterUserId, current)
  }

  const sortedInviterIds = Array.from(metricsByInviter.entries())
    .sort((a, b) =>
      b[1].invitedCount === a[1].invitedCount
        ? b[1].activatedCount - a[1].activatedCount
        : b[1].invitedCount - a[1].invitedCount,
    )
    .slice(0, limit)
    .map(([inviterUserId]) => inviterUserId)

  if (sortedInviterIds.length === 0) return []

  const emailMap = await loadAuthEmailsByUserIds(sortedInviterIds)

  // 获取邀请链接的 share_code 作为 referralCode
  const { data: linksData, error: linksError } = await supabase
    .from("referral_links")
    .select("creator_user_id,share_code")
    .in("creator_user_id", sortedInviterIds)

  const referralCodeByUserId = new Map<string, string | null>()
  if (!linksError && linksData) {
    for (const link of linksData) {
      const userId = String((link as any)?.creator_user_id || "").trim()
      const shareCode = String((link as any)?.share_code || "").trim()
      if (userId) referralCodeByUserId.set(userId, shareCode || null)
    }
  }

  // 获取点击统计（按 share_code）
  const referralCodes = uniqueStrings(Array.from(referralCodeByUserId.values()))
  if (referralCodes.length > 0) {
    const { data: clickRows, error: clickError } = await supabase
      .from("referral_clicks")
      .select("share_code")
      .in("share_code", referralCodes)

    if (!clickError && clickRows) {
      const clickByCode = new Map<string, number>()
      for (const row of clickRows) {
        const code = String((row as any)?.share_code || "").trim()
        if (!code) continue
        clickByCode.set(code, (clickByCode.get(code) || 0) + 1)
      }

      for (const [userId, code] of referralCodeByUserId.entries()) {
        if (!code) continue
        const metrics = metricsByInviter.get(userId)
        if (metrics) metrics.clickCount = clickByCode.get(code) || 0
      }
    }
  }

  // 获取奖励统计（按 user_id）
  const { data: rewardsData, error: rewardsError } = await supabase
    .from("referral_rewards")
    .select("user_id,amount")
    .eq("status", "granted")
    .in("user_id", sortedInviterIds)

  if (!rewardsError && rewardsData) {
    for (const row of rewardsData) {
      const userId = normalizeUserId((row as any)?.user_id)
      if (!userId) continue
      const metrics = metricsByInviter.get(userId)
      if (metrics) metrics.rewardDays += safeNumber((row as any)?.amount)
    }
  }

  return sortedInviterIds.map((inviterUserId) => {
    const metrics = metricsByInviter.get(inviterUserId) || {
      invitedCount: 0,
      activatedCount: 0,
      rewardDays: 0,
      clickCount: 0,
    }

    return {
      inviterUserId,
      inviterEmail: emailMap.get(inviterUserId) || null,
      referralCode: referralCodeByUserId.get(inviterUserId) || null,
      clickCount: metrics.clickCount,
      invitedCount: metrics.invitedCount,
      activatedCount: metrics.activatedCount,
      rewardDays: metrics.rewardDays,
    }
  })
}

export async function getMarketAdminRelations(input?: {
  page?: number | string
  limit?: number | string
}): Promise<MarketListResult<MarketRelationRow>> {
  const page = parsePage(input?.page, 1)
  const limit = parseLimit(input?.limit, 20, 100)
  const offset = (page - 1) * limit

  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：CloudBase 邀请关系列表 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      const collection = db.collection("referral_relations")

      // CloudBase 分页：使用 skip/limit，按 created_at 倒序
      const queryRes = await collection
        .orderBy("created_at", "desc")
        .skip(offset)
        .limit(limit)
        .get()

      // 总数使用 count（注意 count 不支持同时 orderBy/skip）
      const countRes = await collection.count()

      const rows: MarketRelationRow[] = (queryRes.data || []).map((row: any) => {
        const inviterUserId = String(row?.inviter_user_id || "").trim()
        const invitedUserId = String(row?.invited_user_id || "").trim()

        return {
          relationId: String(row?._id || ""),
          inviterUserId,
          inviterEmail: null, // CloudBase 暂无邮箱信息
          invitedUserId,
          invitedEmail: null,
          shareCode: String(row?.share_code || ""),
          toolSlug: row?.tool_slug || null,
          firstToolId: row?.first_tool_id || null,
          status: String(row?.status || "bound"),
          createdAt: String(row?.created_at || ""),
          activatedAt: row?.activated_at ? String(row?.activated_at) : null,
        }
      })

      return {
        rows,
        total: safeNumber(countRes.total),
        page,
        limit,
      }
    } catch (error) {
      console.error("[Market Relations CN] CloudBase error, return empty list:", error)
      return {
        rows: [],
        total: 0,
        page,
        limit,
      }
    }
  }

  const supabase = requireSupabaseAdmin()

  const { data: relationsData, error: relationsError, count } = await supabase
    .from("referral_relations")
    .select("id,inviter_user_id,invited_user_id,share_code,tool_slug,first_tool_id,status,created_at,activated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (relationsError) throw new Error(relationsError.message)

  const inviterIds = (relationsData || []).map((row) => String((row as any)?.inviter_user_id || "").trim())
  const invitedIds = (relationsData || []).map((row) => String((row as any)?.invited_user_id || "").trim())
  const emailMap = await loadAuthEmailsByUserIds([...inviterIds, ...invitedIds])

  const rows: MarketRelationRow[] = (relationsData || []).map((row) => {
    const inviterUserId = String((row as any)?.inviter_user_id || "").trim()
    const invitedUserId = String((row as any)?.invited_user_id || "").trim()

    return {
      relationId: String((row as any)?.id),
      inviterUserId,
      inviterEmail: emailMap.get(inviterUserId) || null,
      invitedUserId,
      invitedEmail: emailMap.get(invitedUserId) || null,
      shareCode: String((row as any)?.share_code || ""),
      toolSlug: (row as any)?.tool_slug || null,
      firstToolId: (row as any)?.first_tool_id || null,
      status: String((row as any)?.status || "bound"),
      createdAt: String((row as any)?.created_at || ""),
      activatedAt: (row as any)?.activated_at ? String((row as any)?.activated_at) : null,
    }
  })

  return {
    rows,
    total: safeNumber(count),
    page,
    limit,
  }
}

export async function getMarketAdminRewards(input?: {
  page?: number | string
  limit?: number | string
}): Promise<MarketListResult<MarketRewardRow>> {
  const page = parsePage(input?.page, 1)
  const limit = parseLimit(input?.limit, 20, 100)
  const offset = (page - 1) * limit

  if (IS_DOMESTIC_VERSION) {
    // ================== 国内版：CloudBase 奖励明细 ==================
    try {
      const connector = new CloudBaseConnector()
      await connector.initialize()
      const db = connector.getClient()

      const collection = db.collection("referral_rewards")

      const queryRes = await collection
        .orderBy("created_at", "desc")
        .skip(offset)
        .limit(limit)
        .get()

      const countRes = await collection.count()

      const rows: MarketRewardRow[] = (queryRes.data || []).map((row: any) => {
        const userId = String(row?.user_id || "").trim()
        return {
          rewardId: String(row?._id || ""),
          relationId: row?.relation_id ? String(row?.relation_id) : null,
          userId,
          userEmail: null, // CloudBase 暂无邮箱信息
          rewardType: String(row?.reward_type || ""),
          amount: safeNumber(row?.amount),
          status: String(row?.status || ""),
          referenceId: String(row?.reference_id || ""),
          createdAt: String(row?.created_at || ""),
          grantedAt: row?.granted_at ? String(row?.granted_at) : null,
        }
      })

      return {
        rows,
        total: safeNumber(countRes.total),
        page,
        limit,
      }
    } catch (error) {
      console.error("[Market Rewards CN] CloudBase error, return empty list:", error)
      return {
        rows: [],
        total: 0,
        page,
        limit,
      }
    }
  }

  const supabase = requireSupabaseAdmin()

  const { data: rewardsData, error: rewardsError, count } = await supabase
    .from("referral_rewards")
    .select("id,relation_id,user_id,reward_type,amount,status,reference_id,created_at,granted_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (rewardsError) throw new Error(rewardsError.message)

  const userIds = (rewardsData || []).map((row) => String((row as any)?.user_id || "").trim())
  const emailMap = await loadAuthEmailsByUserIds(userIds)

  const rows: MarketRewardRow[] = (rewardsData || []).map((row) => {
    const userId = String((row as any)?.user_id || "").trim()
    return {
      rewardId: String((row as any)?.id),
      relationId: (row as any)?.relation_id ? String((row as any)?.relation_id) : null,
      userId,
      userEmail: emailMap.get(userId) || null,
      rewardType: String((row as any)?.reward_type || ""),
      amount: safeNumber((row as any)?.amount),
      status: String((row as any)?.status || ""),
      referenceId: String((row as any)?.reference_id || ""),
      createdAt: String((row as any)?.created_at || ""),
      grantedAt: (row as any)?.granted_at ? String((row as any)?.granted_at) : null,
    }
  })

  return {
    rows,
    total: safeNumber(count),
    page,
    limit,
  }
}

