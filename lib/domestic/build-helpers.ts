/**
 * 国内版平台构建 API 通用模块
 * 提供共享的认证、配额检查和构建记录管理功能
 */

import { cookies } from "next/headers";
import { CloudBaseAuthService, CloudBaseAuthUser } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { checkDailyBuildQuota, consumeDailyBuildQuota, getUserWallet, refundDailyBuildQuota } from "@/services/wallet";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";

export interface BuildAuthResult {
  success: boolean;
  user?: CloudBaseAuthUser;
  error?: string;
  status?: number;
}

export interface QuotaCheckResult {
  success: boolean;
  allowed?: boolean;
  remaining?: number;
  limit?: number;
  error?: string;
}

export interface CreateBuildParams {
  userId: string;
  platform: string;
  appName: string;
  url: string;
  packageName?: string;
  versionName?: string;
  versionCode?: number;
  privacyPolicy?: string;
  iconPath?: string | null;
  extraData?: Record<string, any>;
}

/**
 * 验证用户身份
 */
export async function authenticateUser(): Promise<BuildAuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return { success: false, error: "Unauthorized", status: 401 };
  }

  const authService = new CloudBaseAuthService();
  const user = await authService.validateToken(token);

  if (!user) {
    return { success: false, error: "Invalid or expired token", status: 401 };
  }

  return { success: true, user };
}

/**
 * 检查并扣除构建配额
 */
export async function checkAndDeductQuota(userId: string, count: number = 1): Promise<QuotaCheckResult> {
  // 检查配额
  const quotaCheck = await checkDailyBuildQuota(userId, count);
  if (!quotaCheck.allowed) {
    return {
      success: false,
      allowed: false,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      error: `Daily build quota exceeded. Remaining: ${quotaCheck.remaining}/${quotaCheck.limit}`,
    };
  }

  // 扣除配额
  const deductResult = await consumeDailyBuildQuota(userId, count);
  if (!deductResult.success) {
    return {
      success: false,
      error: deductResult.error || "Failed to deduct build quota",
    };
  }

  return {
    success: true,
    allowed: true,
    remaining: quotaCheck.remaining - count,
    limit: quotaCheck.limit,
  };
}

/**
 * 创建构建记录
 */
export async function createBuildRecord(params: CreateBuildParams): Promise<{ success: boolean; buildId?: string; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取用户套餐信息计算过期时间
    const wallet = await getUserWallet(params.userId);
    const expireDays = wallet?.file_retention_days || getPlanBuildExpireDays("free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    const buildData = {
      user_id: params.userId,
      platform: params.platform,
      status: "pending",
      app_name: params.appName,
      package_name: params.packageName || null,
      version_name: params.versionName || "1.0.0",
      version_code: params.versionCode || 1,
      url: params.url,
      privacy_policy: params.privacyPolicy || null,
      icon_path: params.iconPath || null,
      output_file_path: null,
      download_url: null,
      error_message: null,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...params.extraData,
    };

    let result;
    try {
      result = await db.collection("builds").add(buildData);
    } catch (dbError) {
      console.error(`[Domestic ${params.platform} Build] Database insert error:`, dbError);
      await refundDailyBuildQuota(params.userId, 1);
      return {
        success: false,
        error: "Failed to create build record",
      };
    }

    return { success: true, buildId: result.id };
  } catch (error) {
    console.error("[Domestic Build] Create record error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create build record",
    };
  }
}

/**
 * 更新构建状态
 */
export async function updateBuildStatus(
  buildId: string,
  status: "pending" | "processing" | "completed" | "failed",
  extraData?: Record<string, any>
): Promise<boolean> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("builds").doc(buildId).update({
      status,
      updated_at: new Date().toISOString(),
      ...extraData,
    });

    return true;
  } catch (error) {
    console.error("[Domestic Build] Update status error:", error);
    return false;
  }
}

/**
 * 退还构建配额（导出 wallet 服务的函数）
 */
export { refundDailyBuildQuota } from "@/services/wallet";
