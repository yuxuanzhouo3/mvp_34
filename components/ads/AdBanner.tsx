"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  getAdsByPosition,
  trackAdImpression,
  trackAdClick,
  type Ad,
} from "@/services/ads-client";
import { cn } from "@/lib/utils";

interface AdBannerProps {
  position: "left" | "right" | "top" | "bottom";
  region?: string;
  platform?: string;
  className?: string;
}

export function AdBanner({
  position,
  region = "global",
  platform = "all",
  className,
}: AdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [impressionTracked, setImpressionTracked] = useState<Set<string>>(new Set());

  // 获取广告
  useEffect(() => {
    async function fetchAds() {
      setLoading(true);
      const data = await getAdsByPosition(position, {
        region,
        platform,
        limit: 5,
      });
      setAds(data);
      setLoading(false);
    }
    fetchAds();
  }, [position, region, platform]);

  // 记录展示埋点
  useEffect(() => {
    if (ads.length > 0 && !impressionTracked.has(ads[currentIndex].id)) {
      const adId = ads[currentIndex].id;
      trackAdImpression(adId);
      setImpressionTracked((prev) => new Set(prev).add(adId));
    }
  }, [ads, currentIndex, impressionTracked]);

  // 轮播（如果有多个广告）
  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 8000); // 8秒轮播

    return () => clearInterval(interval);
  }, [ads.length]);

  // 点击处理
  const handleClick = useCallback((ad: Ad) => {
    trackAdClick(ad.id);
    if (ad.link_url) {
      if (ad.link_type === "external") {
        window.open(ad.link_url, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = ad.link_url;
      }
    }
  }, []);

  if (loading || ads.length === 0) {
    return null;
  }

  const currentAd = ads[currentIndex];

  // 根据位置确定样式
  const positionStyles = {
    left: "fixed left-0 top-1/2 -translate-y-1/2 w-[160px] h-[600px]",
    right: "fixed right-0 top-1/2 -translate-y-1/2 w-[160px] h-[600px]",
    top: "w-full h-[90px]",
    bottom: "w-full h-[90px]",
  };

  return (
    <div
      className={cn(
        "overflow-hidden cursor-pointer transition-opacity hover:opacity-90",
        positionStyles[position],
        className
      )}
      onClick={() => handleClick(currentAd)}
      role="banner"
      aria-label={currentAd.title}
    >
      {currentAd.media_type === "image" ? (
        <Image
          src={currentAd.media_url}
          alt={currentAd.title}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <video
          src={currentAd.media_url}
          poster={currentAd.thumbnail_url}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      )}

      {/* 广告标识 */}
      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded">
        广告
      </div>

      {/* 轮播指示器 */}
      {ads.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          {ads.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                index === currentIndex ? "bg-white" : "bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AdBanner;
