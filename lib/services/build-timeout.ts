/**
 * 构建超时工具
 * 为所有构建服务提供统一的超时机制
 */

// 默认超时时间（毫秒）
export const BUILD_TIMEOUT = {
  CHROME: 60 * 1000,      // Chrome 扩展: 60秒
  ANDROID: 90 * 1000,     // Android: 90秒
  IOS: 90 * 1000,         // iOS: 90秒
  HARMONYOS: 90 * 1000,   // HarmonyOS: 90秒
  WECHAT: 60 * 1000,      // WeChat: 60秒
  WINDOWS: 90 * 1000,     // Windows: 90秒
  MACOS: 90 * 1000,       // MacOS: 90秒
  LINUX: 90 * 1000,       // Linux: 90秒
};

// 构建错误类型
export enum BuildErrorType {
  TIMEOUT = "TIMEOUT",
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  STORAGE = "STORAGE",
  UNKNOWN = "UNKNOWN",
}

// 构建错误类
export class BuildError extends Error {
  type: BuildErrorType;
  details?: Record<string, unknown>;

  constructor(message: string, type: BuildErrorType = BuildErrorType.UNKNOWN, details?: Record<string, unknown>) {
    super(message);
    this.name = "BuildError";
    this.type = type;
    this.details = details;
  }
}

// 获取用户友好的错误消息
export function getErrorMessage(error: unknown, lang: "zh" | "en" = "en"): string {
  if (error instanceof BuildError) {
    const messages: Record<BuildErrorType, { zh: string; en: string }> = {
      [BuildErrorType.TIMEOUT]: {
        zh: "构建超时，请稍后重试",
        en: "Build timed out, please try again later",
      },
      [BuildErrorType.NETWORK]: {
        zh: "网络错误，请检查网络连接",
        en: "Network error, please check your connection",
      },
      [BuildErrorType.VALIDATION]: {
        zh: "参数验证失败，请检查输入",
        en: "Validation failed, please check your input",
      },
      [BuildErrorType.STORAGE]: {
        zh: "存储错误，请稍后重试",
        en: "Storage error, please try again later",
      },
      [BuildErrorType.UNKNOWN]: {
        zh: "未知错误，请稍后重试",
        en: "Unknown error, please try again later",
      },
    };
    return messages[error.type][lang];
  }
  return lang === "zh" ? "构建失败，请稍后重试" : "Build failed, please try again later";
}

/**
 * 带超时的 Promise 包装器
 * @param promise 要执行的 Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param errorMessage 超时错误信息
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * 创建可取消的超时 Promise
 */
export function createTimeoutController(timeoutMs: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  let isTimedOut = false;

  const start = () => {
    return new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(new Error(`Build timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });
  };

  const clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const checkTimeout = () => {
    if (isTimedOut) {
      throw new Error(`Build timed out after ${timeoutMs / 1000} seconds`);
    }
  };

  return { start, clear, checkTimeout, isTimedOut: () => isTimedOut };
}
