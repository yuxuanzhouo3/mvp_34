/**
 * GitHub API 速率限制监控和管理
 * 防止触发 GitHub API 限流
 */

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

class GitHubRateLimiter {
  private static instance: GitHubRateLimiter;
  private rateLimitInfo: RateLimitInfo | null = null;
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL = 60 * 1000; // 每分钟检查一次

  private constructor() {}

  static getInstance(): GitHubRateLimiter {
    if (!GitHubRateLimiter.instance) {
      GitHubRateLimiter.instance = new GitHubRateLimiter();
    }
    return GitHubRateLimiter.instance;
  }

  /**
   * 更新速率限制信息
   */
  updateRateLimit(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset),
        used: used ? parseInt(used) : 0,
      };
      this.lastCheck = Date.now();

      // 记录速率限制信息
      if (this.rateLimitInfo.remaining < 100) {
        console.warn(
          `[GitHub API] ⚠️ Rate limit warning: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit} remaining`
        );
      }
    }
  }

  /**
   * 检查是否应该降低请求频率
   */
  shouldThrottle(): boolean {
    if (!this.rateLimitInfo) {
      return false;
    }

    const { remaining, limit } = this.rateLimitInfo;
    const usagePercent = ((limit - remaining) / limit) * 100;

    // 如果使用率超过 80%，建议降低频率
    return usagePercent > 80;
  }

  /**
   * 检查是否接近限额
   */
  isNearLimit(): boolean {
    if (!this.rateLimitInfo) {
      return false;
    }

    return this.rateLimitInfo.remaining < 100;
  }

  /**
   * 获取建议的轮询间隔（毫秒）
   */
  getRecommendedInterval(baseInterval: number): number {
    if (!this.rateLimitInfo) {
      return baseInterval;
    }

    const { remaining, limit } = this.rateLimitInfo;
    const usagePercent = ((limit - remaining) / limit) * 100;

    if (usagePercent > 90) {
      // 使用率超过 90%，间隔增加到 3 倍
      return baseInterval * 3;
    } else if (usagePercent > 80) {
      // 使用率超过 80%，间隔增加到 2 倍
      return baseInterval * 2;
    }

    return baseInterval;
  }

  /**
   * 获取速率限制信息
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * 获取重置时间（距离现在的秒数）
   */
  getSecondsUntilReset(): number {
    if (!this.rateLimitInfo) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, this.rateLimitInfo.reset - now);
  }

  /**
   * 记录 API 使用统计
   */
  logStats(): void {
    if (!this.rateLimitInfo) {
      console.log('[GitHub API] No rate limit info available');
      return;
    }

    const { limit, remaining, used } = this.rateLimitInfo;
    const usagePercent = ((limit - remaining) / limit) * 100;
    const resetIn = this.getSecondsUntilReset();

    console.log(
      `[GitHub API] 📊 Usage: ${used}/${limit} (${usagePercent.toFixed(1)}%), ` +
      `Remaining: ${remaining}, Reset in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`
    );
  }
}

export const githubRateLimiter = GitHubRateLimiter.getInstance();
