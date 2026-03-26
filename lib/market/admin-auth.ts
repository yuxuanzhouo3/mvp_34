import jwt from "jsonwebtoken"
import { NextRequest, NextResponse } from "next/server"

export const MARKET_ADMIN_SESSION_COOKIE = "market_admin_session"

function getMarketAdminJwtSecret() {
  return (
    process.env.MARKET_ADMIN_JWT_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_PANEL_TOKEN ||
    "market-admin-dev-secret"
  )
}

function getAdminCredentials() {
  const username = String(process.env.ADMIN_USERNAME || "admin").trim()
  const password = String(process.env.ADMIN_PASSWORD || "").trim()
  return { username, password }
}

export function verifyMarketAdminLogin(input: { username?: string; password?: string }) {
  const { username, password } = getAdminCredentials()
  const rawPassword = String(input.password || "").trim()

  if (!password) {
    throw new Error("ADMIN_PASSWORD is not configured")
  }

  return String(input.username || "").trim() === username && rawPassword === password
}

export function createMarketAdminSessionToken(username: string) {
  return jwt.sign({ sub: username, role: "market_admin" }, getMarketAdminJwtSecret(), { expiresIn: "7d" })
}

export function decodeMarketAdminSessionToken(token?: string | null): { username: string } | null {
  if (!token) return null

  try {
    const payload = jwt.verify(token, getMarketAdminJwtSecret()) as any
    if (payload?.role !== "market_admin") return null
    return { username: String(payload?.sub || "admin") }
  } catch {
    return null
  }
}

export function attachMarketAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: MARKET_ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearMarketAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: MARKET_ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export function readMarketAdminSessionFromRequest(request: NextRequest): { username: string } | null {
  const token = request.cookies.get(MARKET_ADMIN_SESSION_COOKIE)?.value
  return decodeMarketAdminSessionToken(token)
}

export function verifyMarketAdminToken(request: NextRequest): { ok: true; admin: { username: string } } | { ok: false; response: NextResponse } {
  const session = readMarketAdminSessionFromRequest(request)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { ok: true, admin: session }
}
