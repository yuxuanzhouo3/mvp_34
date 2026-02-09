/**
 * CloudBase 统一重试包装器
 * 自动处理超时和连接错误，提供重试机制
 */

interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * 包装CloudBase操作，自动处理超时和重试
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 10000,
    backoffMs = 1000,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 使用Promise.race实现超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error: any) {
      lastError = error;

      // 判断是否应该重试
      const isRetryable =
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('https:://'); // CloudBase SDK bug

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // 回调通知重试
      if (onRetry) {
        onRetry(attempt, error);
      }

      // 指数退避等待
      const waitTime = backoffMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

/**
 * CloudBase数据库操作包装器
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> {
  return withRetry(operation, {
    maxRetries: 3,
    timeoutMs: 10000,
    onRetry: (attempt, error) => {
      console.warn(
        `[CloudBase Retry] ${operationName} failed (attempt ${attempt}/3):`,
        error?.code || error?.message || 'Unknown error'
      );
    },
  });
}
