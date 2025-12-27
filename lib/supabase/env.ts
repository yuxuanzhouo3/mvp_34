/**
 * 环境变量加载工具
 * 支持多种变量命名方式，兼容不同部署平台
 */

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim() !== "") return v;
  }
  return undefined;
}

export function getSupabaseUrlFromEnv(): string | undefined {
  return firstNonEmpty(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function getSupabaseAnonKeyFromEnv(): string | undefined {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY
  );
}

export function getSupabaseServiceRoleKeyFromEnv(): string | undefined {
  return firstNonEmpty(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
    process.env.SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY
  );
}

export function getSiteUrl(): string {
  // 优先使用 NEXT_PUBLIC_SITE_URL，其次使用 VERCEL_URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 开发环境默认
  return "http://localhost:3000";
}
