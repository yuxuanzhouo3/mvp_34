/**
 * 支付埋点追踪共享模块
 */

import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";

/** 支付埋点参数 */
export interface PaymentTrackingParams {
  userId: string;
  amount: number;
  currency: string;
  plan: string;
  provider: string;
  orderId: string;
}

/** 订阅埋点参数 */
export interface SubscriptionTrackingParams {
  userId: string;
  action: "subscribe" | "upgrade" | "renew" | "downgrade";
  fromPlan?: string;
  toPlan: string;
  period: "monthly" | "annual";
}

/**
 * 追踪支付事件（静默失败）
 */
export function trackPayment(params: PaymentTrackingParams): void {
  const { userId, amount, currency, plan, provider, orderId } = params;
  trackPaymentEvent(userId, { amount, currency, plan, provider, orderId })
    .catch((err) => console.warn(`[analytics] trackPaymentEvent error:`, err));
}

/**
 * 追踪订阅变更事件（静默失败）
 */
export function trackSubscription(params: SubscriptionTrackingParams): void {
  const { userId, action, fromPlan = "Free", toPlan, period } = params;
  trackSubscriptionEvent(userId, { action, fromPlan, toPlan, period })
    .catch((err) => console.warn(`[analytics] trackSubscriptionEvent error:`, err));
}

/**
 * 追踪支付和订阅事件（组合调用）
 */
export function trackPaymentAndSubscription(
  payment: PaymentTrackingParams,
  subscription: Omit<SubscriptionTrackingParams, "userId">
): void {
  trackPayment(payment);
  trackSubscription({ userId: payment.userId, ...subscription });
}
