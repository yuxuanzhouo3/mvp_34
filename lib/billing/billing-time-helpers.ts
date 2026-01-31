// lib/billing/billing-time-helpers.ts
// 账单时间计算工具（北京时间）

/** 北京时间偏移量（毫秒） */
export const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 年月日类型 */
export interface YMD {
  year: number;
  month: number;
  day: number;
}

/** 账期重置状态 */
export interface PaidResetState {
  due: boolean;
  anchorIso: string;
  anchorDay: number;
}

/**
 * 将日期转换为北京时间
 */
export function toBeijingDate(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + BEIJING_OFFSET_MS);
}

/**
 * 获取北京时间的年月日
 */
export function getBeijingYMD(date: Date): YMD {
  const bj = toBeijingDate(date);
  return { year: bj.getFullYear(), month: bj.getMonth() + 1, day: bj.getDate() };
}

/**
 * 计算北京时间午夜对应的 UTC 毫秒数
 */
export function beijingMidnightUtcMs(ymd: YMD): number {
  return Date.UTC(ymd.year, ymd.month - 1, ymd.day, -8, 0, 0);
}

/**
 * 获取指定月份的天数
 */
export function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

/**
 * 将锚点日期限制在月份有效范围内
 */
export function clampAnchorDay(year: number, month1Based: number, anchorDay: number): number {
  return Math.min(anchorDay, daysInMonth(year, month1Based));
}

/**
 * 日历月累加，保持账单锚点（含月末粘性）
 */
export function addCalendarMonths(baseDate: Date, months: number, anchorDay: number): Date {
  const result = new Date(baseDate);
  const currentYear = result.getFullYear();
  const currentMonth = result.getMonth();
  const currentDay = result.getDate();

  // 计算目标年月
  const targetMonth = currentMonth + months;
  const targetYear = currentYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // 确定目标日期（使用锚点日或当前日）
  const targetDay = anchorDay || currentDay;
  const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(targetDay, maxDay);

  // 设置新日期（先重置日期，避免 31 号切月导致溢出）
  result.setDate(1);
  result.setFullYear(targetYear);
  result.setMonth(normalizedMonth);
  result.setDate(finalDay);

  return result;
}

/**
 * 计算"下一个账单日"对应的北京日期（支持月末粘性：31 -> 28/29 -> 回弹 31）
 */
export function getNextBillingDateSticky(currentDate: Date, anchorDay: number): Date {
  const { year, month } = getBeijingYMD(currentDate);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const day = clampAnchorDay(nextYear, nextMonth, anchorDay);
  const utcMs = beijingMidnightUtcMs({ year: nextYear, month: nextMonth, day });
  return new Date(utcMs);
}

/**
 * 基于 billing_cycle_anchor 和 last_reset_at 计算当前账期是否应重置
 */
export function computePaidResetState(
  lastResetIso?: string,
  anchorDay?: number,
  now: Date = new Date()
): PaidResetState {
  const nowYmd = getBeijingYMD(now);
  const nowMidnight = beijingMidnightUtcMs(nowYmd);

  let resolvedAnchorDay = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : nowYmd.day;
  let baseDate = now;
  let invalidBase = true;

  if (lastResetIso) {
    const last = new Date(lastResetIso);
    if (!Number.isNaN(last.getTime())) {
      baseDate = last;
      invalidBase = false;
      if (!anchorDay) {
        resolvedAnchorDay = getBeijingYMD(last).day;
      }
    }
  }

  const baseYmd = getBeijingYMD(baseDate);
  const anchorYmd = {
    year: baseYmd.year,
    month: baseYmd.month,
    day: clampAnchorDay(baseYmd.year, baseYmd.month, resolvedAnchorDay),
  };

  let anchorMidnight = beijingMidnightUtcMs(anchorYmd);
  let nextDate = getNextBillingDateSticky(new Date(anchorMidnight), resolvedAnchorDay);
  let nextMidnight = nextDate.getTime();
  let due = invalidBase;

  while (nowMidnight >= nextMidnight) {
    due = true;
    anchorMidnight = nextMidnight;
    nextDate = getNextBillingDateSticky(new Date(anchorMidnight), resolvedAnchorDay);
    nextMidnight = nextDate.getTime();
  }

  return { due, anchorIso: new Date(anchorMidnight).toISOString(), anchorDay: resolvedAnchorDay };
}
