/**
 * 广告客户端服务
 * 用于前端获取广告和记录埋点
 */

import { createClient } from "@/lib/supabase/client";

export interface Ad {
  id: string;
  title: string;
  description?: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url?: string;
  link_url?: string;
  link_type: string;
  position: string;
  platform: string;
  region: string;
}

/**
 * 获取指定位置的广告
 */
export async function getAdsByPosition(
  position: "left" | "right" | "top" | "bottom",
  options?: {
    region?: string;
    platform?: string;
    limit?: number;
  }
): Promise<Ad[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from("ads")
      .select("id, title, description, media_type, media_url, thumbnail_url, link_url, link_type, position, platform, region")
      .eq("position", position)
      .eq("status", "active")
      .order("priority", { ascending: false });

    if (options?.region) {
      query = query.or(`region.eq.${options.region},region.eq.all`);
    }

    if (options?.platform) {
      query = query.or(`platform.eq.${options.platform},platform.eq.all`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[ads-client] getAdsByPosition error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[ads-client] getAdsByPosition exception:", error);
    return [];
  }
}

/**
 * 记录广告展示
 */
export async function trackAdImpression(adId: string): Promise<void> {
  try {
    await fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, eventType: "impression" }),
    });
  } catch (error) {
    console.warn("[ads-client] trackAdImpression error:", error);
  }
}

/**
 * 记录广告点击
 */
export async function trackAdClick(adId: string): Promise<void> {
  try {
    await fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, eventType: "click" }),
    });
  } catch (error) {
    console.warn("[ads-client] trackAdClick error:", error);
  }
}
