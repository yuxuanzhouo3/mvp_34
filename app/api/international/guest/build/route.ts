import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

// 增加函数执行时间限制
export const maxDuration = 120;

// 游客每日构建限制（从环境变量获取）
const GUEST_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_GUEST_DAILY_LIMIT || "1";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(10, n);
})();

// 游客是否支持批量构建
const GUEST_SUPPORT_BATCH_BUILD = process.env.NEXT_PUBLIC_GUEST_SUPPORT_BATCH_BUILD === "true";

// 短时间请求限制（防止短时间内大量请求）
const BURST_LIMIT = 3; // 每分钟最多 3 次请求
const BURST_WINDOW = 60 * 1000; // 1 分钟窗口

// 内存中的 IP 限制缓存（生产环境建议使用 Redis/KV）
const ipRateLimitCache = new Map<string, { count: number; resetTime: number }>();
const ipBurstCache = new Map<string, { count: number; windowStart: number }>();

// 定期清理过期缓存（每小时）
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimitCache.entries()) {
    if (record.resetTime < now) {
      ipRateLimitCache.delete(ip);
    }
  }
  for (const [ip, record] of ipBurstCache.entries()) {
    if (record.windowStart + BURST_WINDOW < now) {
      ipBurstCache.delete(ip);
    }
  }
}, 60 * 60 * 1000);

/**
 * 获取客户端 IP（安全版本）
 * 优先使用 Vercel 提供的真实 IP，防止伪造
 */
function getClientIp(req: NextRequest): string {
  // Vercel 提供的真实客户端 IP（不可伪造）
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  // Cloudflare 提供的真实 IP
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }

  // 回退到 x-forwarded-for（可能被伪造，但有总比没有好）
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * 生成 IP 指纹（结合多个因素）
 */
function getIpFingerprint(req: NextRequest): string {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLanguage = req.headers.get("accept-language") || "";

  // 组合多个因素生成指纹，增加伪造难度
  const fingerprint = `${ip}|${userAgent.substring(0, 100)}|${acceptLanguage.substring(0, 50)}`;
  return crypto.createHash("sha256").update(fingerprint).digest("hex").substring(0, 32);
}

/**
 * 检查短时间请求限制（防刷）
 */
function checkBurstLimit(fingerprint: string): boolean {
  const now = Date.now();
  const record = ipBurstCache.get(fingerprint);

  if (!record || record.windowStart + BURST_WINDOW < now) {
    ipBurstCache.set(fingerprint, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= BURST_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * 获取 UTC 时区的今日结束时间戳
 */
function getUTCDayEndTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.getTime();
}

/**
 * 检查每日 IP 限流（使用 UTC 时区，每日 00:00 UTC 重置）
 */
function checkIpRateLimit(fingerprint: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const utcDayEnd = getUTCDayEndTimestamp();
  const record = ipRateLimitCache.get(fingerprint);

  if (!record || record.resetTime < now) {
    ipRateLimitCache.set(fingerprint, { count: 1, resetTime: utcDayEnd });
    return { allowed: true, remaining: GUEST_DAILY_LIMIT - 1 };
  }

  if (record.count >= GUEST_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: GUEST_DAILY_LIMIT - record.count };
}

/**
 * 验证 User-Agent（基本的机器人检测）
 */
function isValidUserAgent(req: NextRequest): boolean {
  const userAgent = req.headers.get("user-agent") || "";

  // 拒绝空 User-Agent
  if (!userAgent || userAgent.length < 10) {
    return false;
  }

  // 拒绝常见的爬虫/机器人 User-Agent
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python-requests/i, /axios/i,
    /postman/i, /insomnia/i, /httpie/i
  ];

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      return false;
    }
  }

  return true;
}

/**
 * 验证 URL 格式（防止恶意 URL）
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 http 和 https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }
    // 禁止本地地址和私有 IP
    const hostname = parsed.hostname.toLowerCase();

    // 检查 IPv6 本地地址
    if (
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname.startsWith("[fe80:") ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("[fc") ||
      hostname.startsWith("[fd") ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd")
    ) {
      return false;
    }

    // 检查 IPv4 本地地址和私有 IP
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("169.254.") // 链路本地地址
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证应用名称（防止注入和路径遍历）
 */
function sanitizeAppName(name: string): string {
  // 检查路径遍历攻击
  if (name.includes("..") || name.includes("./")) {
    return "App";
  }
  // 移除危险字符，只保留字母、数字、空格、中文
  return name
    .replace(/[<>\"'`\\\/\{\}\[\]\(\)]/g, "")
    .substring(0, 50)
    .trim() || "App";
}

/**
 * 支持的平台类型
 */
type Platform = "android" | "windows" | "macos" | "linux" | "chrome";

/**
 * 平台配置
 */
const PLATFORM_CONFIG: Record<Platform, { bucket: string; zipFile: string; configPath: string }> = {
  android: {
    bucket: "Android",
    zipFile: "android.zip",
    configPath: "app/src/main/assets/appConfig.json",
  },
  windows: {
    bucket: "Windows",
    zipFile: "windows.zip",
    configPath: "src-tauri/tauri.conf.json",
  },
  macos: {
    bucket: "macOS",
    zipFile: "macos.zip",
    configPath: "src-tauri/tauri.conf.json",
  },
  linux: {
    bucket: "Linux",
    zipFile: "linux.zip",
    configPath: "src-tauri/tauri.conf.json",
  },
  chrome: {
    bucket: "Chrome",
    zipFile: "chrome.zip",
    configPath: "manifest.json",
  },
};

/**
 * 游客构建 API
 * - 不落库
 * - 不落存储桶
 * - 直接返回构建结果（Base64）
 * - 多层安全防护
 */
export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    // 安全检查 1: User-Agent 验证（防机器人）
    if (!isValidUserAgent(request)) {
      console.warn("[Guest Build] Invalid User-Agent detected");
      return NextResponse.json(
        { error: "Invalid request", message: "Request blocked" },
        { status: 403 }
      );
    }

    // 安全检查 2: 生成指纹并检查短时间请求限制（防刷）
    const fingerprint = getIpFingerprint(request);
    if (!checkBurstLimit(fingerprint)) {
      console.warn(`[Guest Build] Burst limit exceeded for fingerprint: ${fingerprint.substring(0, 8)}...`);
      return NextResponse.json(
        { error: "Too many requests", message: "Please wait a moment before trying again" },
        { status: 429 }
      );
    }

    // 安全检查 3: 每日限流
    const rateLimit = checkIpRateLimit(fingerprint);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Daily guest build limit reached. Please login for more builds.",
          remaining: 0,
          limit: GUEST_DAILY_LIMIT,
        },
        { status: 429 }
      );
    }

    // 解析请求参数
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const rawAppName = formData.get("appName") as string;
    const platform = (formData.get("platform") as string)?.toLowerCase() as Platform;

    // 验证必填字段
    if (!url || !rawAppName || !platform) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and platform are required" },
        { status: 400 }
      );
    }

    // 安全检查 4: URL 验证（防止恶意 URL）
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid URL", message: "URL must be a valid public HTTP/HTTPS address" },
        { status: 400 }
      );
    }

    // 安全检查 5: 应用名称清理（防注入）
    const appName = sanitizeAppName(rawAppName);
    if (!appName || appName.length < 1) {
      return NextResponse.json(
        { error: "Invalid app name", message: "App name contains invalid characters" },
        { status: 400 }
      );
    }

    // 验证平台
    if (!PLATFORM_CONFIG[platform]) {
      return NextResponse.json(
        { error: "Invalid platform", message: `Supported platforms: ${Object.keys(PLATFORM_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }

    // 检查批量构建限制
    const platformCount = formData.get("platformCount");
    if (platformCount && parseInt(platformCount as string, 10) > 1 && !GUEST_SUPPORT_BATCH_BUILD) {
      return NextResponse.json(
        { error: "Batch build not supported", message: "Guest users can only build one platform at a time" },
        { status: 400 }
      );
    }

    // 获取平台配置
    const config = PLATFORM_CONFIG[platform];
    const supabase = createServiceClient();

    // 下载模板 ZIP
    console.log(`[Guest Build] Downloading ${config.zipFile} for ${platform}...`);
    const { data: zipData, error: downloadError } = await supabase.storage
      .from(config.bucket)
      .download(config.zipFile);

    if (downloadError || !zipData) {
      console.error(`[Guest Build] Failed to download template:`, downloadError);
      return NextResponse.json(
        { error: "Template error", message: "Failed to download build template" },
        { status: 500 }
      );
    }

    // 创建临时目录并解压
    const buildId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    tempDir = path.join(os.tmpdir(), `guest-build-${buildId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipBuffer = Buffer.from(await zipData.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    // 查找项目根目录
    const projectRoot = findProjectRoot(tempDir, platform);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find project root");
    }

    // 更新配置文件
    await updateConfig(projectRoot, platform, { url, appName });

    // 重新打包
    console.log(`[Guest Build] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    // 返回结果（Base64 编码）
    const base64Data = outputBuffer.toString("base64");
    const fileName = `${appName.replace(/\s+/g, "-").toLowerCase()}-${platform}-source.zip`;

    console.log(`[Guest Build] Completed for ${platform}, size: ${outputBuffer.length} bytes, fingerprint: ${fingerprint.substring(0, 8)}...`);

    return NextResponse.json({
      success: true,
      platform,
      fileName,
      fileSize: outputBuffer.length,
      data: base64Data,
      remaining: rateLimit.remaining,
      limit: GUEST_DAILY_LIMIT,
      message: "Build completed successfully",
    });
  } catch (error) {
    console.error("[Guest Build] Error:", error);
    return NextResponse.json(
      { error: "Build failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("[Guest Build] Failed to cleanup temp dir:", e);
      }
    }
  }
}

/**
 * 查找项目根目录
 */
function findProjectRoot(tempDir: string, platform: Platform): string | null {
  const entries = fs.readdirSync(tempDir);

  // 检查是否直接是项目根目录
  if (platform === "android") {
    if (entries.includes("app") && fs.statSync(path.join(tempDir, "app")).isDirectory()) {
      return tempDir;
    }
  } else if (platform === "chrome") {
    if (entries.includes("manifest.json")) {
      return tempDir;
    }
  } else {
    // Windows/macOS/Linux (Tauri)
    if (entries.includes("src-tauri") && fs.statSync(path.join(tempDir, "src-tauri")).isDirectory()) {
      return tempDir;
    }
  }

  // 检查子目录
  for (const entry of entries) {
    const entryPath = path.join(tempDir, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      const result = findProjectRoot(entryPath, platform);
      if (result) return result;
    }
  }

  return null;
}

/**
 * 更新配置文件
 */
async function updateConfig(
  projectRoot: string,
  platform: Platform,
  config: { url: string; appName: string }
): Promise<void> {
  const platformConfig = PLATFORM_CONFIG[platform];

  if (platform === "android") {
    // Android: 更新 appConfig.json
    const configPath = path.join(projectRoot, platformConfig.configPath);
    if (fs.existsSync(configPath)) {
      const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      content.url = config.url;
      content.appName = config.appName;
      fs.writeFileSync(configPath, JSON.stringify(content, null, 2), "utf-8");
    }
  } else if (platform === "chrome") {
    // Chrome: 更新 manifest.json
    const configPath = path.join(projectRoot, platformConfig.configPath);
    if (fs.existsSync(configPath)) {
      const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      content.name = config.appName;
      content.description = `${config.appName} - Web App`;
      fs.writeFileSync(configPath, JSON.stringify(content, null, 2), "utf-8");
    }
    // 更新 popup.html 或 background.js 中的 URL
    const popupPath = path.join(projectRoot, "popup.html");
    if (fs.existsSync(popupPath)) {
      let popupContent = fs.readFileSync(popupPath, "utf-8");
      popupContent = popupContent.replace(/https?:\/\/[^\s"'<>]+/g, config.url);
      fs.writeFileSync(popupPath, popupContent, "utf-8");
    }
  } else {
    // Tauri (Windows/macOS/Linux): 更新 tauri.conf.json
    const configPath = path.join(projectRoot, platformConfig.configPath);
    if (fs.existsSync(configPath)) {
      const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (content.build) {
        content.build.devUrl = config.url;
      }
      if (content.app?.windows?.[0]) {
        content.app.windows[0].title = config.appName;
        content.app.windows[0].url = config.url;
      }
      // 兼容旧版 Tauri 配置
      if (content.tauri?.windows?.[0]) {
        content.tauri.windows[0].title = config.appName;
        content.tauri.windows[0].url = config.url;
      }
      if (content.package) {
        content.package.productName = config.appName;
      }
      fs.writeFileSync(configPath, JSON.stringify(content, null, 2), "utf-8");
    }
  }
}

/**
 * 递归添加文件夹到 ZIP
 */
function addFolderToZip(zip: AdmZip, folderPath: string, zipPath: string): void {
  const entries = fs.readdirSync(folderPath);

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry);
    const entryZipPath = zipPath ? `${zipPath}/${entry}` : entry;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      addFolderToZip(zip, fullPath, entryZipPath);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.addFile(entryZipPath, content);
    }
  }
}
