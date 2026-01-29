"use server";

/**
 * 后台管理统计数据 Server Actions
 * 支持双数据源：Supabase (国际版) + CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { verifyAdminSession } from "@/utils/session";

export interface DashboardStats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    dau: number;  // 日活跃用户
    wau: number;  // 周活跃用户
    mau: number;  // 月活跃用户
  };
  revenue: {
    total: number;      // USD 收入
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  revenueCny: {         // CNY 收入（人民币）
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  subscriptions: {
    total: number;
    byPlan: Record<string, number>;
  };
  orders: {
    total: number;
    today: number;
    paid: number;
    pending: number;
    failed: number;
  };
  devices: {
    byOs: Record<string, number>;
    byDeviceType: Record<string, number>;
  };
}

export interface DailyStats {
  date: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
}

export interface RevenueStats {
  date: string;
  amount: number;      // USD 收入
  amountCny: number;   // CNY 收入
  orderCount: number;
  payingUsers: number;
}

// ============================================================================
// CloudBase 查询函数
// ============================================================================

async function getCloudBaseStats(): Promise<DashboardStats | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command;

    // 国内版使用北京时间(UTC+8)进行统计,符合国内用户习惯
    const now = new Date();
    const beijingOffsetMs = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）

    // 计算北京时间的今天0点（UTC毫秒数）
    const beijingNow = new Date(now.getTime() + beijingOffsetMs);
    const todayStartUtc = Date.UTC(
      beijingNow.getUTCFullYear(),
      beijingNow.getUTCMonth(),
      beijingNow.getUTCDate(),
      0, 0, 0, 0
    ) - beijingOffsetMs;
    const weekAgoUtc = todayStartUtc - 7 * 24 * 60 * 60 * 1000;
    const monthAgoUtc = todayStartUtc - 30 * 24 * 60 * 60 * 1000;

    // 用户统计 - 支持 createdAt 和 created_at 两种字段名
    const usersCollection = db.collection("users");
    const totalUsers = await usersCollection.count().then((r: { total: number }) => r.total).catch(() => 0);

    // 获取最近一个月的用户数据用于统计
    const recentUsersData = await usersCollection
      .where(_.or([
        { createdAt: _.gte(new Date(monthAgoUtc).toISOString()) },
        { created_at: _.gte(new Date(monthAgoUtc).toISOString()) }
      ]))
      .limit(10000)
      .get()
      .catch(() => ({ data: [] }));

    const recentUsers = recentUsersData.data || [];

    // 本地过滤统计,使用UTC毫秒数进行比较
    let todayUsers = 0, weekUsers = 0, monthUsers = 0;
    recentUsers.forEach((u: { createdAt?: string; created_at?: string }) => {
      const dateStr = u.createdAt || u.created_at;
      if (!dateStr) return;
      const userTimeUtc = new Date(dateStr).getTime();
      if (userTimeUtc >= todayStartUtc) todayUsers++;
      if (userTimeUtc >= weekAgoUtc) weekUsers++;
      if (userTimeUtc >= monthAgoUtc) monthUsers++;
    });

    // 活跃用户统计 (DAU/WAU/MAU) - 从 user_analytics 表查询
    let dau = 0, wau = 0, mau = 0;
    try {
      const analyticsCollection = db.collection("user_analytics");
      const analyticsData = await analyticsCollection
        .where({ created_at: _.gte(new Date(monthAgoUtc).toISOString()), source: "cn" })
        .limit(10000)
        .get();

      const analytics = analyticsData.data || [];
      const dauUsers = new Set<string>();
      const wauUsers = new Set<string>();
      const mauUsers = new Set<string>();

      // 本地过滤,使用UTC毫秒数进行比较
      analytics.forEach((a: { created_at?: string; user_id?: string }) => {
        if (!a.created_at || !a.user_id) return;
        const activityTimeUtc = new Date(a.created_at).getTime();
        if (activityTimeUtc >= todayStartUtc) dauUsers.add(a.user_id);
        if (activityTimeUtc >= weekAgoUtc) wauUsers.add(a.user_id);
        if (activityTimeUtc >= monthAgoUtc) mauUsers.add(a.user_id);
      });

      dau = dauUsers.size;
      wau = wauUsers.size;
      mau = mauUsers.size;
    } catch {
      // user_analytics 集合可能不存在
    }

    // 订阅统计 - CloudBase 中 plan 存储在用户对象的 plan 字段
    // 查询 plan 不为 Free/free 的用户
    const allUsersResult = await usersCollection.limit(10000).get().catch(() => ({ data: [] }));
    const allUsers = allUsersResult.data || [];
    const byPlan: Record<string, number> = {};
    let subscriptionCount = 0;

    allUsers.forEach((u: { plan?: string; wallet?: { plan?: string } }) => {
      // 优先使用 u.plan，如果不存在则使用 u.wallet.plan
      const plan = u.plan || u.wallet?.plan;
      if (plan && plan.toLowerCase() !== "free") {
        subscriptionCount++;
        byPlan[plan] = (byPlan[plan] || 0) + 1;
      }
    });

    // 订单统计 - 从 orders 集合查询（使用聚合查询避免 limit 限制）
    let totalOrders = 0, todayOrders = 0, paidOrders = 0, pendingOrders = 0, failedOrders = 0;
    let totalRevenue = 0, todayRevenue = 0, weekRevenue = 0, monthRevenue = 0;

    // 从 orders 集合获取订单/收入数据
    try {
      const ordersCollection = db.collection("orders");

      // 使用聚合查询获取统计数据
      const [totalCount, pendingCount, failedCount, paidOrdersResult] = await Promise.all([
        ordersCollection.count(),
        ordersCollection.where({ payment_status: "pending" }).count(),
        ordersCollection.where({ payment_status: _.in(["failed", "cancelled"]) }).count(),
        ordersCollection.where({ payment_status: "paid" }).field({ amount: true, paid_at: true, created_at: true }).get(),
      ]);

      totalOrders = totalCount.total || 0;
      pendingOrders = pendingCount.total || 0;
      failedOrders = failedCount.total || 0;

      // 处理已支付订单的收入统计 - 使用UTC毫秒数进行比较
      const paidOrdersData = paidOrdersResult.data || [];
      paidOrdersData.forEach((o: { amount?: number; paid_at?: string; created_at?: string }) => {
        const amount = Number(o.amount || 0);
        const paidAtStr = o.paid_at || o.created_at;
        if (!paidAtStr) return;

        const paidAtUtc = new Date(paidAtStr).getTime();
        totalRevenue += amount;

        if (paidAtUtc >= todayStartUtc) {
          todayRevenue += amount;
          todayOrders++;
        }
        if (paidAtUtc >= weekAgoUtc) weekRevenue += amount;
        if (paidAtUtc >= monthAgoUtc) monthRevenue += amount;
      });

      paidOrders = paidOrdersData.length;
    } catch {
      // orders 集合可能不存在，忽略错误
    }

    // 设备统计（使用与 Supabase 一致的时间范围：最近30天）
    const byOs: Record<string, Set<string>> = {};
    const byDeviceType: Record<string, Set<string>> = {};

    try {
      const analyticsCollection = db.collection("user_analytics");
      const sessionsData = await analyticsCollection
        .where({
          event_type: "session_start",
          created_at: _.gte(new Date(monthAgoUtc).toISOString()),
          source: "cn"
        })
        .limit(10000)
        .get();
      const sessions = sessionsData.data || [];

      sessions.forEach((s: { os?: string; device_type?: string; user_id?: string }) => {
        if (!s.user_id) return;
        const os = s.os || "Unknown";
        const deviceType = s.device_type || "Unknown";
        if (!byOs[os]) byOs[os] = new Set();
        if (!byDeviceType[deviceType]) byDeviceType[deviceType] = new Set();
        byOs[os].add(s.user_id);
        byDeviceType[deviceType].add(s.user_id);
      });
    } catch {
      // user_analytics 集合可能不存在，忽略错误
    }

    // 转换 Set 为数字
    const byOsCount: Record<string, number> = {};
    const byDeviceTypeCount: Record<string, number> = {};
    Object.entries(byOs).forEach(([key, userSet]) => {
      byOsCount[key] = userSet.size;
    });
    Object.entries(byDeviceType).forEach(([key, userSet]) => {
      byDeviceTypeCount[key] = userSet.size;
    });

    return {
      users: { total: totalUsers, today: todayUsers, thisWeek: weekUsers, thisMonth: monthUsers, dau, wau, mau },
      revenue: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },  // CloudBase 不使用 USD
      revenueCny: { total: totalRevenue, today: todayRevenue, thisWeek: weekRevenue, thisMonth: monthRevenue },
      subscriptions: { total: subscriptionCount, byPlan },
      orders: { total: totalOrders, today: todayOrders, paid: paidOrders, pending: pendingOrders, failed: failedOrders },
      devices: { byOs: byOsCount, byDeviceType: byDeviceTypeCount },
    };
  } catch (err) {
    console.error("[getCloudBaseStats] Error:", err);
    return null;
  }
}

async function getCloudBaseDailyUsers(days: number): Promise<DailyStats[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command;

    // 使用北京时间计算起始日期（与卡片数据统一的逻辑）
    const now = new Date();
    const beijingOffsetMs = 8 * 60 * 60 * 1000;

    // 计算北京时间的今天0点（UTC毫秒数）
    const beijingNow = new Date(now.getTime() + beijingOffsetMs);
    const todayStartUtc = Date.UTC(
      beijingNow.getUTCFullYear(),
      beijingNow.getUTCMonth(),
      beijingNow.getUTCDate(),
      0, 0, 0, 0
    ) - beijingOffsetMs;
    const startDateUtc = todayStartUtc - (days - 1) * 24 * 60 * 60 * 1000;

    // 获取用户数据 - 支持 createdAt 和 created_at 两种字段名
    const usersData = await db
      .collection("users")
      .where(_.or([
        { createdAt: _.gte(new Date(startDateUtc).toISOString()) },
        { created_at: _.gte(new Date(startDateUtc).toISOString()) }
      ]))
      .limit(10000)
      .get()
      .catch(() => ({ data: [] }));

    const users = usersData.data || [];

    // 按日期聚合新用户 - 使用统一的北京时间转换逻辑
    const dateMap = new Map<string, { activeUsers: Set<string>; newUsers: number; sessions: number }>();

    users.forEach((u: { createdAt?: string; created_at?: string; _id?: string }) => {
      const dateStr = u.createdAt || u.created_at;
      if (!dateStr) return;
      const userTimeUtc = new Date(dateStr).getTime();

      // 计算该用户属于哪一天（北京时间）
      const daysSinceStart = Math.floor((userTimeUtc - startDateUtc) / (24 * 60 * 60 * 1000));
      const dayStartUtc = startDateUtc + daysSinceStart * 24 * 60 * 60 * 1000;

      // 转换为北京时间日期字符串
      const beijingDate = new Date(dayStartUtc + beijingOffsetMs);
      const date = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;

      if (!dateMap.has(date)) {
        dateMap.set(date, { activeUsers: new Set(), newUsers: 0, sessions: 0 });
      }
      const entry = dateMap.get(date)!;
      entry.newUsers++;
      // 注意：不在这里添加到activeUsers，活跃用户只从analytics统计
    });

    // 尝试获取 analytics 数据
    try {
      const analyticsData = await db
        .collection("user_analytics")
        .where({ created_at: _.gte(new Date(startDateUtc).toISOString()), source: "cn" })
        .limit(10000)
        .get();

      const analytics = analyticsData.data || [];

      analytics.forEach((a: { created_at?: string; user_id?: string; event_type?: string }) => {
        if (!a.created_at) return;
        const activityTimeUtc = new Date(a.created_at).getTime();

        // 计算该活动属于哪一天（北京时间）
        const daysSinceStart = Math.floor((activityTimeUtc - startDateUtc) / (24 * 60 * 60 * 1000));
        const dayStartUtc = startDateUtc + daysSinceStart * 24 * 60 * 60 * 1000;

        // 转换为北京时间日期字符串
        const beijingDate = new Date(dayStartUtc + beijingOffsetMs);
        const date = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;

        if (!dateMap.has(date)) {
          dateMap.set(date, { activeUsers: new Set(), newUsers: 0, sessions: 0 });
        }
        const entry = dateMap.get(date)!;
        if (a.user_id) entry.activeUsers.add(a.user_id);
        if (a.event_type === "build_complete") entry.sessions++;
      });
    } catch {
      // user_analytics 集合可能不存在
    }

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        activeUsers: data.activeUsers.size,
        newUsers: data.newUsers,
        sessions: data.sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 升序排列，图表从左到右显示时间
  } catch (err) {
    console.error("[getCloudBaseDailyUsers] Error:", err);
    return [];
  }
}

async function getCloudBaseDailyRevenue(days: number): Promise<RevenueStats[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 使用北京时间计算起始日期
    const now = new Date();
    const beijingOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = (beijingOffset + localOffset) * 60 * 1000;
    const beijingNow = new Date(now.getTime() + offsetDiff);

    const startDate = new Date(beijingNow.getTime() - days * 24 * 60 * 60 * 1000);

    // 按日期聚合
    const dateMap = new Map<string, { amount: number; orderCount: number; payingUsers: Set<string> }>();

    // 从 orders 集合获取收入数据
    try {
      const ordersData = await db
        .collection("orders")
        .where({ payment_status: "paid", source: "cn" })
        .limit(10000)
        .get();

      const orders = ordersData.data || [];

      orders.forEach((o: { paid_at?: string; created_at?: string; amount?: number; user_id?: string }) => {
        const dateStr = o.paid_at || o.created_at;
        if (!dateStr) return;

        const orderDate = new Date(dateStr);
        if (orderDate < startDate) return;

        // 转换为北京时间
        const beijingDate = new Date(orderDate.getTime() + offsetDiff);
        const date = `${beijingDate.getFullYear()}-${String(beijingDate.getMonth() + 1).padStart(2, '0')}-${String(beijingDate.getDate()).padStart(2, '0')}`;

        if (!dateMap.has(date)) {
          dateMap.set(date, { amount: 0, orderCount: 0, payingUsers: new Set() });
        }
        const entry = dateMap.get(date)!;
        entry.amount += Number(o.amount || 0);
        entry.orderCount++;
        if (o.user_id) entry.payingUsers.add(o.user_id);
      });
    } catch {
      // orders 集合可能不存在
    }

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        amount: 0,  // CloudBase 不使用 USD
        amountCny: data.amount,
        orderCount: data.orderCount,
        payingUsers: data.payingUsers.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 升序排列，图表从左到右显示时间
  } catch (err) {
    console.error("[getCloudBaseDailyRevenue] Error:", err);
    return [];
  }
}

// ============================================================================
// Supabase 查询函数
// ============================================================================

async function getSupabaseStats(source: "all" | "global"): Promise<DashboardStats | null> {
  if (!supabaseAdmin) return null;

  try {
    // 传入 UTC 时间，数据库函数负责转换为北京时间
    const { data, error } = await supabaseAdmin.rpc("get_admin_dashboard_stats", {
      p_source: source === "all" ? "global" : source,
      p_timezone_offset: 8, // 北京时间 UTC+8
    });

    if (error) {
      console.error("[getSupabaseStats] Error:", error);
      return null;
    }

    return {
      users: {
        total: data?.users?.total || 0,
        today: data?.users?.today || 0,
        thisWeek: data?.users?.this_week || 0,
        thisMonth: data?.users?.this_month || 0,
        dau: data?.users?.dau || 0,
        wau: data?.users?.wau || 0,
        mau: data?.users?.mau || 0,
      },
      revenue: {
        total: Number(data?.revenue?.total || 0),
        today: Number(data?.revenue?.today || 0),
        thisWeek: Number(data?.revenue?.this_week || 0),
        thisMonth: Number(data?.revenue?.this_month || 0),
      },
      revenueCny: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },  // Supabase 不使用 CNY
      subscriptions: {
        total: data?.subscriptions?.total || 0,
        byPlan: data?.subscriptions?.by_plan || {},
      },
      orders: {
        total: data?.orders?.total || 0,
        today: data?.orders?.today || 0,
        paid: data?.orders?.paid || 0,
        pending: data?.orders?.pending || 0,
        failed: data?.orders?.failed || 0,
      },
      devices: {
        byOs: data?.devices?.by_os || {},
        byDeviceType: data?.devices?.by_device_type || {},
      },
    };
  } catch (err) {
    console.error("[getSupabaseStats] Unexpected error:", err);
    return null;
  }
}

async function getSupabaseDailyUsers(source: "all" | "global", days: number): Promise<DailyStats[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin.rpc("get_daily_active_users", {
      p_source: source === "all" ? "global" : source,
      p_days: days,
      p_timezone_offset: 8, // 北京时间 UTC+8
    });

    if (error) {
      console.error("[getSupabaseDailyUsers] Error:", error);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      date: row.stat_date as string,
      activeUsers: Number(row.active_users || 0),
      newUsers: Number(row.new_users || 0),
      sessions: Number(row.sessions || 0),
    }));
  } catch (err) {
    console.error("[getSupabaseDailyUsers] Unexpected error:", err);
    return [];
  }
}

async function getSupabaseDailyRevenue(source: "all" | "global", days: number): Promise<RevenueStats[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin.rpc("get_daily_revenue", {
      p_source: source === "all" ? "global" : source,
      p_days: days,
      p_timezone_offset: 8, // 北京时间 UTC+8
    });

    if (error) {
      console.error("[getSupabaseDailyRevenue] Error:", error);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      date: row.stat_date as string,
      amount: Number(row.total_amount || 0),
      amountCny: 0,  // Supabase 不使用 CNY
      orderCount: Number(row.order_count || 0),
      payingUsers: Number(row.paying_users || 0),
    }));
  } catch (err) {
    console.error("[getSupabaseDailyRevenue] Unexpected error:", err);
    return [];
  }
}

// ============================================================================
// 合并工具函数
// ============================================================================

/**
 * 生成完整的日期范围（从 startDate 到今天）
 * 对于没有数据的日期，填充默认值
 */
function fillDateRange(data: DailyStats[], days: number): DailyStats[] {
  // 使用北京时间（UTC+8）计算日期范围，与统计函数保持一致
  const now = new Date();
  const beijingOffsetMs = 8 * 60 * 60 * 1000;
  const beijingNow = new Date(now.getTime() + beijingOffsetMs);

  // 计算北京时间的今天和起始日期
  const todayBj = new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate()
  ));
  const startDateBj = new Date(todayBj);
  startDateBj.setUTCDate(startDateBj.getUTCDate() - days + 1);

  const dateMap = new Map<string, DailyStats>();
  data.forEach(item => dateMap.set(item.date, item));

  const result: DailyStats[] = [];
  const current = new Date(startDateBj);

  while (current <= todayBj) {
    const dateStr = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;

    if (dateMap.has(dateStr)) {
      result.push(dateMap.get(dateStr)!);
    } else {
      result.push({
        date: dateStr,
        activeUsers: 0,
        newUsers: 0,
        sessions: 0,
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/**
 * 生成完整的日期范围（从 startDate 到今天）- 收入数据
 */
function fillRevenueDateRange(data: RevenueStats[], days: number): RevenueStats[] {
  // 使用北京时间（UTC+8）计算日期范围，与统计函数保持一致
  const now = new Date();
  const beijingOffsetMs = 8 * 60 * 60 * 1000;
  const beijingNow = new Date(now.getTime() + beijingOffsetMs);

  // 计算北京时间的今天和起始日期
  const todayBj = new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate()
  ));
  const startDateBj = new Date(todayBj);
  startDateBj.setUTCDate(startDateBj.getUTCDate() - days + 1);

  const dateMap = new Map<string, RevenueStats>();
  data.forEach(item => dateMap.set(item.date, item));

  const result: RevenueStats[] = [];
  const current = new Date(startDateBj);

  while (current <= todayBj) {
    const dateStr = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;

    if (dateMap.has(dateStr)) {
      result.push(dateMap.get(dateStr)!);
    } else {
      result.push({
        date: dateStr,
        amount: 0,
        amountCny: 0,
        orderCount: 0,
        payingUsers: 0,
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

function mergeStats(a: DashboardStats | null, b: DashboardStats | null): DashboardStats | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  const mergedByPlan: Record<string, number> = { ...a.subscriptions.byPlan };
  Object.entries(b.subscriptions.byPlan).forEach(([plan, count]) => {
    mergedByPlan[plan] = (mergedByPlan[plan] || 0) + count;
  });

  const mergedByOs: Record<string, number> = { ...a.devices.byOs };
  Object.entries(b.devices.byOs).forEach(([os, count]) => {
    mergedByOs[os] = (mergedByOs[os] || 0) + count;
  });

  const mergedByDeviceType: Record<string, number> = { ...a.devices.byDeviceType };
  Object.entries(b.devices.byDeviceType).forEach(([type, count]) => {
    mergedByDeviceType[type] = (mergedByDeviceType[type] || 0) + count;
  });

  // 计算总用户数和设备统计
  const totalUsers = a.users.total + b.users.total;

  // 计算有操作系统信息的用户总数
  const totalOsUsers = Object.values(mergedByOs).reduce((sum, count) => sum + count, 0);
  const unknownOsUsers = totalUsers - totalOsUsers;
  if (unknownOsUsers > 0) {
    mergedByOs['未知'] = unknownOsUsers;
  }

  // 计算有设备信息的用户总数
  const totalDeviceUsers = Object.values(mergedByDeviceType).reduce((sum, count) => sum + count, 0);
  const unknownDeviceUsers = totalUsers - totalDeviceUsers;
  if (unknownDeviceUsers > 0) {
    mergedByDeviceType['未知'] = unknownDeviceUsers;
  }

  const mergedDau = a.users.dau + b.users.dau;

  return {
    users: {
      total: a.users.total + b.users.total,
      today: a.users.today + b.users.today,
      thisWeek: a.users.thisWeek + b.users.thisWeek,
      thisMonth: a.users.thisMonth + b.users.thisMonth,
      dau: mergedDau,
      wau: a.users.wau + b.users.wau,
      mau: a.users.mau + b.users.mau,
    },
    revenue: {
      total: a.revenue.total + b.revenue.total,
      today: a.revenue.today + b.revenue.today,
      thisWeek: a.revenue.thisWeek + b.revenue.thisWeek,
      thisMonth: a.revenue.thisMonth + b.revenue.thisMonth,
    },
    revenueCny: {
      total: a.revenueCny.total + b.revenueCny.total,
      today: a.revenueCny.today + b.revenueCny.today,
      thisWeek: a.revenueCny.thisWeek + b.revenueCny.thisWeek,
      thisMonth: a.revenueCny.thisMonth + b.revenueCny.thisMonth,
    },
    subscriptions: {
      total: a.subscriptions.total + b.subscriptions.total,
      byPlan: mergedByPlan,
    },
    orders: {
      total: a.orders.total + b.orders.total,
      today: a.orders.today + b.orders.today,
      paid: a.orders.paid + b.orders.paid,
      pending: a.orders.pending + b.orders.pending,
      failed: a.orders.failed + b.orders.failed,
    },
    devices: {
      byOs: mergedByOs,
      byDeviceType: mergedByDeviceType,
    },
  };
}

function mergeDailyStats(a: DailyStats[], b: DailyStats[]): DailyStats[] {
  const dateMap = new Map<string, DailyStats>();

  a.forEach((item) => {
    dateMap.set(item.date, { ...item });
  });

  b.forEach((item) => {
    if (dateMap.has(item.date)) {
      const existing = dateMap.get(item.date)!;
      existing.activeUsers += item.activeUsers;
      existing.newUsers += item.newUsers;
      existing.sessions += item.sessions;
    } else {
      dateMap.set(item.date, { ...item });
    }
  });

  return Array.from(dateMap.values()).sort((x, y) => x.date.localeCompare(y.date));
}

function mergeRevenueStats(a: RevenueStats[], b: RevenueStats[]): RevenueStats[] {
  const dateMap = new Map<string, RevenueStats>();

  a.forEach((item) => {
    dateMap.set(item.date, { ...item });
  });

  b.forEach((item) => {
    if (dateMap.has(item.date)) {
      const existing = dateMap.get(item.date)!;
      existing.amount += item.amount;
      existing.amountCny += item.amountCny;
      existing.orderCount += item.orderCount;
      existing.payingUsers += item.payingUsers;
    } else {
      dateMap.set(item.date, { ...item });
    }
  });

  return Array.from(dateMap.values()).sort((x, y) => x.date.localeCompare(y.date)); // 升序排列
}

// ============================================================================
// 导出的 API 函数
// ============================================================================

/**
 * 获取仪表盘统计数据
 * @param source - 数据来源: 'all' | 'global' | 'cn'
 */
export async function getDashboardStats(
  source: "all" | "global" | "cn" = "all"
): Promise<DashboardStats | null> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getDashboardStats] Unauthorized access attempt");
    return null;
  }

  try {
    if (source === "cn") {
      // 仅查询 CloudBase
      return await getCloudBaseStats();
    } else if (source === "global") {
      // 仅查询 Supabase
      return await getSupabaseStats("global");
    } else {
      // 查询两个数据源并合并
      const [cloudbaseData, supabaseData] = await Promise.all([
        getCloudBaseStats(),
        getSupabaseStats("global"),
      ]);
      return mergeStats(cloudbaseData, supabaseData);
    }
  } catch (err) {
    console.error("[getDashboardStats] Unexpected error:", err);
    return null;
  }
}

/**
 * 获取每日活跃用户统计
 */
export async function getDailyActiveUsers(
  source: "all" | "global" | "cn" = "all",
  days: number = 30
): Promise<DailyStats[]> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getDailyActiveUsers] Unauthorized access attempt");
    return [];
  }

  try {
    let result: DailyStats[];
    if (source === "cn") {
      result = await getCloudBaseDailyUsers(days);
    } else if (source === "global") {
      result = await getSupabaseDailyUsers("global", days);
    } else {
      const [cloudbaseData, supabaseData, supabaseStats] = await Promise.all([
        getCloudBaseDailyUsers(days),
        getSupabaseDailyUsers("global", days),
        getSupabaseStats("global"), // 获取卡片统计数据
      ]);

      // 检查Supabase折线图数据是否缺少今天的数据
      const todayBj = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const todayStr = `${todayBj.getUTCFullYear()}-${String(todayBj.getUTCMonth() + 1).padStart(2, '0')}-${String(todayBj.getUTCDate()).padStart(2, '0')}`;

      const hasTodayData = supabaseData.some(item => item.date === todayStr);

      // 如果缺少今天的数据，从卡片统计中补充
      if (!hasTodayData && supabaseStats && supabaseStats.users.dau > 0) {
        supabaseData.push({
          date: todayStr,
          activeUsers: supabaseStats.users.dau,
          newUsers: supabaseStats.users.today,
          sessions: 0,
        });
      }

      result = mergeDailyStats(cloudbaseData, supabaseData);
    }
    // 填充完整的日期范围，确保横坐标统一且到今天
    return fillDateRange(result, days);
  } catch (err) {
    console.error("[getDailyActiveUsers] Unexpected error:", err);
    return [];
  }
}

/**
 * 获取每日收入统计
 */
export async function getDailyRevenue(
  source: "all" | "global" | "cn" = "all",
  days: number = 30
): Promise<RevenueStats[]> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getDailyRevenue] Unauthorized access attempt");
    return [];
  }

  try {
    let result: RevenueStats[];
    if (source === "cn") {
      result = await getCloudBaseDailyRevenue(days);
    } else if (source === "global") {
      result = await getSupabaseDailyRevenue("global", days);
    } else {
      const [cloudbaseData, supabaseData] = await Promise.all([
        getCloudBaseDailyRevenue(days),
        getSupabaseDailyRevenue("global", days),
      ]);
      result = mergeRevenueStats(cloudbaseData, supabaseData);
    }
    // 填充完整的日期范围，确保横坐标统一且到今天
    return fillRevenueDateRange(result, days);
  } catch (err) {
    console.error("[getDailyRevenue] Unexpected error:", err);
    return [];
  }
}
