import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

// 增加函数执行时间限制
export const maxDuration = 120;

// 游客每日构建限制
const GUEST_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_GUEST_DAILY_LIMIT || "1";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(10, n);
})();

// 短时间请求限制
const BURST_LIMIT = 3;
const BURST_WINDOW = 60 * 1000;

// 内存中的限制缓存
const ipRateLimitCache = new Map<string, { count: number; resetTime: number }>();
const ipBurstCache = new Map<string, { count: number; windowStart: number }>();

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimitCache.entries()) {
    if (record.resetTime < now) ipRateLimitCache.delete(ip);
  }
  for (const [ip, record] of ipBurstCache.entries()) {
    if (record.windowStart + BURST_WINDOW < now) ipBurstCache.delete(ip);
  }
}, 60 * 60 * 1000);

function getClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function getIpFingerprint(req: NextRequest): string {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLanguage = req.headers.get("accept-language") || "";
  const fingerprint = `${ip}|${userAgent.substring(0, 100)}|${acceptLanguage.substring(0, 50)}`;
  return crypto.createHash("sha256").update(fingerprint).digest("hex").substring(0, 32);
}

function checkBurstLimit(fingerprint: string): boolean {
  const now = Date.now();
  const record = ipBurstCache.get(fingerprint);

  if (!record || record.windowStart + BURST_WINDOW < now) {
    ipBurstCache.set(fingerprint, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= BURST_LIMIT) return false;
  record.count++;
  return true;
}

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

function isValidUserAgent(req: NextRequest): boolean {
  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent || userAgent.length < 10) return false;

  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python-requests/i, /axios/i,
    /postman/i, /insomnia/i, /httpie/i
  ];

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) return false;
  }

  return true;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeAppName(name: string): string {
  if (name.includes("..") || name.includes("./")) return "App";
  return name
    .replace(/[<>"'`\\\/\{\}\[\]\(\)]/g, "")
    .substring(0, 50)
    .trim() || "App";
}

type Platform = "android" | "ios" | "harmonyos";

const PLATFORM_CONFIG: Record<Platform, { storagePath: string; configPath: string }> = {
  android: {
    storagePath: "Android/android.zip",
    configPath: "app/src/main/assets/appConfig.json",
  },
  ios: {
    storagePath: "iOS/ios.zip",
    configPath: "config/appConfig.json",
  },
  harmonyos: {
    storagePath: "HarmonyOS/harmonyos.zip",
    configPath: "entry/src/main/resources/rawfile/appConfig.json",
  },
};

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    // 安全检查
    if (!isValidUserAgent(request)) {
      return NextResponse.json(
        { error: "Invalid request", message: "Request blocked" },
        { status: 403 }
      );
    }

    const fingerprint = getIpFingerprint(request);
    if (!checkBurstLimit(fingerprint)) {
      return NextResponse.json(
        { error: "Too many requests", message: "Please wait a moment before trying again" },
        { status: 429 }
      );
    }

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

    if (!url || !rawAppName || !platform) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and platform are required" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid URL", message: "URL must be a valid public HTTP/HTTPS address" },
        { status: 400 }
      );
    }

    const appName = sanitizeAppName(rawAppName);
    if (!appName || appName.length < 1) {
      return NextResponse.json(
        { error: "Invalid app name", message: "App name contains invalid characters" },
        { status: 400 }
      );
    }

    if (!PLATFORM_CONFIG[platform]) {
      return NextResponse.json(
        { error: "Invalid platform", message: `Supported platforms: ${Object.keys(PLATFORM_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }

    // 获取平台配置
    const config = PLATFORM_CONFIG[platform];
    const storage = getCloudBaseStorage();

    // 下载模板（使用 CloudBase Storage，与登录用户一致）
    console.log(`[Guest Build] Downloading ${config.storagePath}...`);
    const zipBuffer = await storage.downloadFile(config.storagePath);

    // 创建临时目录并解压
    const buildId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    tempDir = path.join(os.tmpdir(), `guest-build-${buildId}`);
    fs.mkdirSync(tempDir, { recursive: true });

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

    console.log(`[Guest Build] Completed for ${platform}, size: ${outputBuffer.length} bytes`);

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

function findProjectRoot(tempDir: string, platform: Platform): string | null {
  const entries = fs.readdirSync(tempDir);

  if (platform === "android") {
    if (entries.includes("app") && fs.statSync(path.join(tempDir, "app")).isDirectory()) {
      return tempDir;
    }
  } else if (platform === "ios") {
    if (entries.includes("config")) {
      return tempDir;
    }
  } else if (platform === "harmonyos") {
    if (entries.includes("entry")) {
      return tempDir;
    }
  }

  for (const entry of entries) {
    const entryPath = path.join(tempDir, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      const result = findProjectRoot(entryPath, platform);
      if (result) return result;
    }
  }

  return null;
}

async function updateConfig(
  projectRoot: string,
  platform: Platform,
  config: { url: string; appName: string }
): Promise<void> {
  const platformConfig = PLATFORM_CONFIG[platform];
  const configPath = path.join(projectRoot, platformConfig.configPath);

  if (fs.existsSync(configPath)) {
    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    content.url = config.url;
    content.appName = config.appName;
    fs.writeFileSync(configPath, JSON.stringify(content, null, 2), "utf-8");
  }
}

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
