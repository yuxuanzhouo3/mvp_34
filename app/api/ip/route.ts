import { NextRequest, NextResponse } from "next/server";
import { geoRouter } from "@/lib/core/geo-router";

export const runtime = "nodejs";

function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  // IPv6 (loose)
  if (ip.includes(":")) {
    const ipv6Loose = /^[0-9a-fA-F:]+$/;
    if (!ipv6Loose.test(ip)) return false;
    const lower = ip.toLowerCase();
    if (lower === "::1") return false;
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    )
      return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("2001:db8")) return false;
    return true;
  }

  return false;
}

function getClientIP(request: NextRequest): string | null {
  // 1) Vercel
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const ips = vercelForwardedFor.split(",").map((v) => v.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) return ip;
    }
  }

  // 2) Cloudflare
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && isValidIP(cfIp)) return cfIp;

  // 3) X-Real-IP
  const realIP = request.headers.get("x-real-ip");
  if (realIP && isValidIP(realIP)) return realIP;

  // 4) X-Forwarded-For
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((v) => v.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) return ip;
    }
  }

  // 5) Other proxy headers
  const possibleHeaders = [
    "x-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "true-client-ip",
  ];
  for (const header of possibleHeaders) {
    const ip = request.headers.get(header);
    if (ip && isValidIP(ip)) return ip;
  }

  // 6) Platform extension
  const vercelIp = (request as unknown as { ip?: string }).ip;
  if (vercelIp && isValidIP(vercelIp)) return vercelIp;

  return null;
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const detected = ip ? await geoRouter.detect(ip) : null;

  return NextResponse.json({
    ip,
    geo: detected,
    headers: {
      "x-vercel-forwarded-for": request.headers.get("x-vercel-forwarded-for"),
      "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
      "x-real-ip": request.headers.get("x-real-ip"),
      "x-forwarded-for": request.headers.get("x-forwarded-for"),
    },
  });
}

