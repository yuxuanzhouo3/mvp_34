/**
 * 监控和告警系统
 * 用于跟踪 API 使用量、错误率和性能指标
 */

interface MetricData {
  count: number;
  errors: number;
  lastReset: number;
}

class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, MetricData> = new Map();
  private readonly RESET_INTERVAL = 60 * 60 * 1000; // 每小时重置一次

  private constructor() {
    // 定期重置指标
    setInterval(() => this.resetMetrics(), this.RESET_INTERVAL);
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * 记录 API 调用
   */
  recordApiCall(apiName: string, success: boolean = true): void {
    const metric = this.getOrCreateMetric(apiName);
    metric.count++;
    if (!success) {
      metric.errors++;
    }

    // 检查是否需要告警
    this.checkThresholds(apiName, metric);
  }

  /**
   * 获取或创建指标
   */
  private getOrCreateMetric(apiName: string): MetricData {
    if (!this.metrics.has(apiName)) {
      this.metrics.set(apiName, {
        count: 0,
        errors: 0,
        lastReset: Date.now(),
      });
    }
    return this.metrics.get(apiName)!;
  }

  /**
   * 检查阈值并触发告警
   */
  private checkThresholds(apiName: string, metric: MetricData): void {
    const errorRate = metric.count > 0 ? (metric.errors / metric.count) * 100 : 0;

    // 错误率告警（超过 10%）
    if (errorRate > 10 && metric.count >= 10) {
      console.error(
        `[Monitor] 🚨 High error rate for ${apiName}: ${errorRate.toFixed(1)}% (${metric.errors}/${metric.count})`
      );
    }

    // GitHub API 使用量告警
    if (apiName === 'github_api') {
      if (metric.count > 4000) {
        console.warn(
          `[Monitor] ⚠️ GitHub API usage high: ${metric.count}/5000 per hour`
        );
      }
    }

    // 轮询频率告警
    if (apiName === 'polling') {
      const timeSinceReset = Date.now() - metric.lastReset;

      // 避免初始化时除以0导致Infinity
      if (timeSinceReset < 1000) {
        return; // 跳过前1秒的频率检查
      }

      const requestsPerMinute = (metric.count / timeSinceReset) * 60 * 1000;

      if (requestsPerMinute > 30) {
        console.warn(
          `[Monitor] ⚠️ High polling frequency: ${requestsPerMinute.toFixed(1)} req/min`
        );
      }
    }
  }

  /**
   * 重置所有指标
   */
  private resetMetrics(): void {
    const now = Date.now();

    // 记录统计信息
    this.logStats();

    // 重置计数器
    for (const [apiName, metric] of this.metrics.entries()) {
      metric.count = 0;
      metric.errors = 0;
      metric.lastReset = now;
    }
  }

  /**
   * 记录统计信息
   */
  logStats(): void {
    console.log('\n[Monitor] 📊 Hourly Statistics:');

    for (const [apiName, metric] of this.metrics.entries()) {
      const errorRate = metric.count > 0 ? (metric.errors / metric.count) * 100 : 0;
      const timeSinceReset = Date.now() - metric.lastReset;
      const hours = timeSinceReset / (60 * 60 * 1000);

      console.log(
        `  ${apiName}: ${metric.count} calls, ${metric.errors} errors (${errorRate.toFixed(1)}%), ` +
        `${(metric.count / hours).toFixed(1)} calls/hour`
      );
    }
    console.log('');
  }

  /**
   * 获取指标数据
   */
  getMetrics(apiName?: string): Map<string, MetricData> | MetricData | undefined {
    if (apiName) {
      return this.metrics.get(apiName);
    }
    return this.metrics;
  }

  /**
   * 手动触发统计报告
   */
  reportStats(): void {
    this.logStats();
  }
}

export const monitoring = MonitoringService.getInstance();
