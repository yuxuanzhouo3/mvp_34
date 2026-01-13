"use server";

/**
 * 交易订单管理 Server Actions
 * 支持 Supabase (国际版) 和 CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export interface Order {
  id: string;
  order_no: string;
  user_id?: string;
  user_email?: string;
  product_name: string;
  product_type: string;
  plan?: string;
  period?: string;
  amount: number;
  currency: string;
  original_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  payment_status: string;
  paid_at?: string;
  provider_order_id?: string;
  provider_transaction_id?: string;
  risk_score: number;
  risk_level: string;
  risk_factors?: unknown[];
  ip_address?: string;
  device_fingerprint?: string;
  user_agent?: string;
  country?: string;
  region_name?: string;
  city?: string;
  source: "global" | "cn";
  refund_status?: string;
  refund_amount?: number;
  refund_reason?: string;
  refunded_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderFilters {
  source?: string;
  payment_status?: string;
  risk_level?: string;
  payment_method?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface OrdersResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

// CloudBase 文档转 Order 接口
function cloudBaseDocToOrder(doc: Record<string, unknown>): Order {
  return {
    id: (doc._id as string) || "",
    order_no: (doc.order_no as string) || "",
    user_id: doc.user_id as string | undefined,
    user_email: doc.user_email as string | undefined,
    product_name: (doc.product_name as string) || "",
    product_type: (doc.product_type as string) || "",
    plan: doc.plan as string | undefined,
    period: doc.period as string | undefined,
    amount: (doc.amount as number) || 0,
    currency: (doc.currency as string) || "CNY",
    original_amount: doc.original_amount as number | undefined,
    discount_amount: doc.discount_amount as number | undefined,
    payment_method: doc.payment_method as string | undefined,
    payment_status: (doc.payment_status as string) || "pending",
    paid_at: doc.paid_at as string | undefined,
    provider_order_id: doc.provider_order_id as string | undefined,
    provider_transaction_id: doc.provider_transaction_id as string | undefined,
    risk_score: (doc.risk_score as number) || 0,
    risk_level: (doc.risk_level as string) || "low",
    risk_factors: doc.risk_factors as unknown[] | undefined,
    ip_address: doc.ip_address as string | undefined,
    device_fingerprint: doc.device_fingerprint as string | undefined,
    user_agent: doc.user_agent as string | undefined,
    country: doc.country as string | undefined,
    region_name: doc.region_name as string | undefined,
    city: doc.city as string | undefined,
    source: (doc.source as "global" | "cn") || "cn",
    refund_status: doc.refund_status as string | undefined,
    refund_amount: doc.refund_amount as number | undefined,
    refund_reason: doc.refund_reason as string | undefined,
    refunded_at: doc.refunded_at as string | undefined,
    notes: doc.notes as string | undefined,
    created_at: (doc.created_at as string) || (doc.createdAt as string) || new Date().toISOString(),
    updated_at: (doc.updated_at as string) || (doc.updatedAt as string) || new Date().toISOString(),
  };
}

// ============================================================================
// Supabase 查询函数 (国际版)
// ============================================================================

async function getSupabaseOrders(filters: OrderFilters): Promise<OrdersResult> {
  if (!supabaseAdmin) {
    return { orders: [], total: 0, page: 1, limit: 20 };
  }

  try {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.payment_status && filters.payment_status !== "all") {
      query = query.eq("payment_status", filters.payment_status);
    }
    if (filters.risk_level && filters.risk_level !== "all") {
      query = query.eq("risk_level", filters.risk_level);
    }
    if (filters.payment_method && filters.payment_method !== "all") {
      query = query.eq("payment_method", filters.payment_method);
    }
    if (filters.search) {
      query = query.or(
        `order_no.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%,provider_order_id.ilike.%${filters.search}%`
      );
    }
    if (filters.start_date) {
      query = query.gte("created_at", filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte("created_at", filters.end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[getSupabaseOrders] Error:", error);
      return { orders: [], total: 0, page, limit };
    }

    return {
      orders: (data || []).map((item) => ({ ...item, source: item.source || "global" })),
      total: count || 0,
      page,
      limit,
    };
  } catch (err) {
    console.error("[getSupabaseOrders] Unexpected error:", err);
    return { orders: [], total: 0, page: 1, limit: 20 };
  }
}

async function getSupabaseOrderStats(): Promise<{
  total: number;
  paid: number;
  pending: number;
  failed: number;
  totalAmount: number;
  highRisk: number;
}> {
  if (!supabaseAdmin) {
    return { total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0, highRisk: 0 };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("payment_status, amount, risk_level");

    if (error) {
      console.error("[getSupabaseOrderStats] Error:", error);
      return { total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0, highRisk: 0 };
    }

    const orders = data || [];
    return {
      total: orders.length,
      paid: orders.filter((o) => o.payment_status === "paid").length,
      pending: orders.filter((o) => o.payment_status === "pending").length,
      failed: orders.filter((o) => o.payment_status === "failed").length,
      totalAmount: orders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + Number(o.amount || 0), 0),
      highRisk: orders.filter((o) => o.risk_level === "high" || o.risk_level === "blocked").length,
    };
  } catch (err) {
    console.error("[getSupabaseOrderStats] Unexpected error:", err);
    return { total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0, highRisk: 0 };
  }
}

// ============================================================================
// CloudBase 查询函数 (国内版)
// ============================================================================

async function getCloudBaseOrders(filters: OrderFilters): Promise<OrdersResult> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions: Record<string, unknown> = {};

    if (filters.payment_status && filters.payment_status !== "all") {
      conditions.payment_status = filters.payment_status;
    }
    if (filters.risk_level && filters.risk_level !== "all") {
      conditions.risk_level = filters.risk_level;
    }
    if (filters.payment_method && filters.payment_method !== "all") {
      conditions.payment_method = filters.payment_method;
    }

    let query = db.collection("orders");

    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions);
    }

    // 获取总数
    const countResult = await query.count();
    const total = countResult.total || 0;

    // 获取分页数据
    const result = await query
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(limit)
      .get();

    return {
      orders: (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToOrder(doc)),
      total,
      page,
      limit,
    };
  } catch (err) {
    console.error("[getCloudBaseOrders] Error:", err);
    return { orders: [], total: 0, page: 1, limit: 20 };
  }
}

async function getCloudBaseOrderStats(): Promise<{
  total: number;
  paid: number;
  pending: number;
  failed: number;
  totalAmount: number;
  highRisk: number;
}> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db
      .collection("orders")
      .field({ payment_status: true, amount: true, risk_level: true })
      .limit(1000)
      .get();

    const orders = result.data || [];
    return {
      total: orders.length,
      paid: orders.filter((o: Record<string, unknown>) => o.payment_status === "paid").length,
      pending: orders.filter((o: Record<string, unknown>) => o.payment_status === "pending").length,
      failed: orders.filter((o: Record<string, unknown>) => o.payment_status === "failed").length,
      totalAmount: orders
        .filter((o: Record<string, unknown>) => o.payment_status === "paid")
        .reduce((sum: number, o: Record<string, unknown>) => sum + Number(o.amount || 0), 0),
      highRisk: orders.filter(
        (o: Record<string, unknown>) => o.risk_level === "high" || o.risk_level === "blocked"
      ).length,
    };
  } catch (err) {
    console.error("[getCloudBaseOrderStats] Error:", err);
    return { total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0, highRisk: 0 };
  }
}

async function updateCloudBaseOrder(
  id: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("orders").doc(id).update({
      ...data,
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error("[updateCloudBaseOrder] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

// ============================================================================
// 导出的 API 函数
// ============================================================================

/**
 * 获取订单列表
 * @param filters - 筛选条件，source 决定查询哪个数据库
 */
export async function getOrders(filters: OrderFilters = {}): Promise<OrdersResult> {
  try {
    if (filters.source === "cn") {
      return await getCloudBaseOrders(filters);
    } else if (filters.source === "global") {
      return await getSupabaseOrders(filters);
    } else {
      // source === "all" 或未指定，合并两个数据源
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const [supabaseResult, cloudbaseResult] = await Promise.all([
        getSupabaseOrders({ ...filters, page: 1, limit: 500 }),
        getCloudBaseOrders({ ...filters, page: 1, limit: 500 }),
      ]);

      // 合并并按时间排序
      const allOrders = [...supabaseResult.orders, ...cloudbaseResult.orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const total = allOrders.length;
      const offset = (page - 1) * limit;
      const paginatedOrders = allOrders.slice(offset, offset + limit);

      return {
        orders: paginatedOrders,
        total,
        page,
        limit,
      };
    }
  } catch (err) {
    console.error("[getOrders] Unexpected error:", err);
    return { orders: [], total: 0, page: 1, limit: 20 };
  }
}

/**
 * 获取单个订单详情
 */
export async function getOrder(id: string, source?: string): Promise<Order | null> {
  try {
    if (source === "cn") {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db.collection("orders").doc(id).get();
      if (result.data && result.data.length > 0) {
        return cloudBaseDocToOrder(result.data[0]);
      }
      return null;
    }

    // 默认查询 Supabase
    if (!supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[getOrder] Error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[getOrder] Unexpected error:", err);
    return null;
  }
}

/**
 * 更新订单备注
 */
export async function updateOrderNotes(
  id: string,
  notes: string,
  source?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (source === "cn") {
      return await updateCloudBaseOrder(id, { notes });
    }

    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[updateOrderNotes] Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[updateOrderNotes] Unexpected error:", err);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 更新订单风控等级
 */
export async function updateOrderRiskLevel(
  id: string,
  risk_level: string,
  risk_score?: number,
  source?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, unknown> = { risk_level };
    if (risk_score !== undefined) {
      updateData.risk_score = risk_score;
    }

    if (source === "cn") {
      return await updateCloudBaseOrder(id, updateData);
    }

    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[updateOrderRiskLevel] Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[updateOrderRiskLevel] Unexpected error:", err);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 获取订单统计
 * @param source - 数据源: global(国际版), cn(国内版), all(全部)
 */
export async function getOrderStats(source: string = "all"): Promise<{
  total: number;
  paid: number;
  pending: number;
  failed: number;
  totalAmount: number;
  highRisk: number;
}> {
  try {
    if (source === "cn") {
      return await getCloudBaseOrderStats();
    } else if (source === "global") {
      return await getSupabaseOrderStats();
    } else {
      // 合并两个数据源的统计
      const [supabaseStats, cloudbaseStats] = await Promise.all([
        getSupabaseOrderStats(),
        getCloudBaseOrderStats(),
      ]);

      return {
        total: supabaseStats.total + cloudbaseStats.total,
        paid: supabaseStats.paid + cloudbaseStats.paid,
        pending: supabaseStats.pending + cloudbaseStats.pending,
        failed: supabaseStats.failed + cloudbaseStats.failed,
        totalAmount: supabaseStats.totalAmount + cloudbaseStats.totalAmount,
        highRisk: supabaseStats.highRisk + cloudbaseStats.highRisk,
      };
    }
  } catch (err) {
    console.error("[getOrderStats] Unexpected error:", err);
    return { total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0, highRisk: 0 };
  }
}
