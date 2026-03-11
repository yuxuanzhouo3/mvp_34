/**
 * CloudBase 数据库连接器
 * 仅国内版使用（DEFAULT_LANGUAGE=zh）
 */

export interface CloudBaseConnectorConfig {
  envId?: string;
  secretId?: string;
  secretKey?: string;
}

export function getMissingCloudBaseEnvVars(
  config: CloudBaseConnectorConfig = {}
): string[] {
  const missing: string[] = [];
  const env = config.envId || process.env.WECHAT_CLOUDBASE_ID;
  const secretId = config.secretId || process.env.CLOUDBASE_SECRET_ID;
  const secretKey = config.secretKey || process.env.CLOUDBASE_SECRET_KEY;

  if (!env) missing.push("WECHAT_CLOUDBASE_ID");
  if (!secretId) missing.push("CLOUDBASE_SECRET_ID");
  if (!secretKey) missing.push("CLOUDBASE_SECRET_KEY");

  return missing;
}

export function isCloudBaseConfigured(config: CloudBaseConnectorConfig = {}): boolean {
  return getMissingCloudBaseEnvVars(config).length === 0;
}

let cachedClient: any = null;
let cachedDb: any = null;
let initPromise: Promise<void> | null = null;
let lastInitTime: number = 0;
const REINIT_INTERVAL = 5 * 60 * 1000; // 5 分钟重新初始化一次

export class CloudBaseConnector {
  private client: any = null;
  private initialized = false;

  constructor(private config: CloudBaseConnectorConfig = {}) {}

  async initialize(): Promise<void> {
    // 检查是否需要重新初始化（超过 5 分钟）
    const now = Date.now();
    if (cachedClient && cachedDb && (now - lastInitTime < REINIT_INTERVAL)) {
      this.client = cachedClient;
      this.initialized = true;
      return;
    }

    // 如果超过 5 分钟，清除缓存并重新初始化
    if (now - lastInitTime >= REINIT_INTERVAL) {
      console.log('[CloudBase] Reinitializing due to timeout interval');
      cachedClient = null;
      cachedDb = null;
      initPromise = null;
    }

    if (initPromise) {
      await initPromise;
      this.client = cachedClient;
      this.initialized = true;
      return;
    }

    // 动态加载，避免打包到 edge runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cloudbase = require("@cloudbase/node-sdk");

    const env = this.config.envId || process.env.WECHAT_CLOUDBASE_ID;
    const secretId = this.config.secretId || process.env.CLOUDBASE_SECRET_ID;
    const secretKey = this.config.secretKey || process.env.CLOUDBASE_SECRET_KEY;

    if (!env || !secretId || !secretKey) {
      throw new Error(
        "Missing CloudBase env vars: WECHAT_CLOUDBASE_ID, CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY"
      );
    }

    initPromise = (async () => {
      const client = cloudbase.init({
        env,
        secretId,
        secretKey,
        timeout: 120000, // 增加超时时间到 120 秒（2分钟）
      });
      cachedClient = client;
      cachedDb = client.database();
    })();

    await initPromise;

    this.client = cachedClient;
    this.initialized = true;
    lastInitTime = Date.now(); // 记录初始化时间
  }

  getClient(): any {
    if (!this.client || !this.initialized) {
      throw new Error("CloudBase client not initialized");
    }
    return cachedDb || this.client.database();
  }

  // Raw SDK instance, used for storage (uploadFile/getTempFileURL/deleteFile)
  getApp(): any {
    if (!this.client || !this.initialized) {
      throw new Error("CloudBase client not initialized");
    }
    return cachedClient || this.client;
  }
}
