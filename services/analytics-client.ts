/**
 * 客户端埋点服务 - 用于前端组件调用
 * 通过 API 路由将埋点数据发送到服务端
 */

export interface TrackEventParams {
  userId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
}

/**
 * 客户端登录埋点
 */
export async function trackLoginEventClient(
  userId: string,
  loginMethod: string = "email"
): Promise<void> {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        eventType: "session_start",
        eventData: { loginMethod },
      }),
    });
  } catch (error) {
    console.warn("[analytics-client] trackLoginEventClient error:", error);
  }
}

/**
 * 客户端注册埋点
 */
export async function trackRegisterEventClient(
  userId: string,
  registerMethod: string = "email"
): Promise<void> {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        eventType: "register",
        eventData: { registerMethod },
      }),
    });
  } catch (error) {
    console.warn("[analytics-client] trackRegisterEventClient error:", error);
  }
}
