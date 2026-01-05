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
};

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
