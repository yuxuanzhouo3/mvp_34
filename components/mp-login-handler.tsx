"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
  exchangeCodeForToken,
} from "@/lib/wechat-mp";

/**
 * 微信小程序登录处理器
 * 在全局范围内处理小程序登录回调参数
 */
export function MpLoginHandler() {
  const router = useRouter();

  const handleMpLoginCallback = useCallback(async () => {
    if (typeof window === "undefined") return;

    const callback = parseWxMpLoginCallback();
    if (!callback) return;

    console.log("[MpLoginHandler] Processing mini program login callback:", callback);

    try {
      // 如果直接收到 token，调用 mp-callback API 设置 cookie
      if (callback.token && callback.openid) {
        console.log("[MpLoginHandler] Direct token received from mini program");
        const res = await fetch("/api/domestic/auth/mp-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: callback.token,
            openid: callback.openid,
            expiresIn: callback.expiresIn,
            nickName: callback.nickName,
            avatarUrl: callback.avatarUrl,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error("[MpLoginHandler] mp-callback failed:", data.error);
        } else {
          console.log("[MpLoginHandler] mp-callback success");
          clearWxMpLoginParams();
          // 刷新页面以加载新会话
          window.location.reload();
        }
        return;
      }

      // 如果收到 code，需要换取 token
      if (callback.code) {
        console.log("[MpLoginHandler] Exchanging code for token");
        const result = await exchangeCodeForToken(
          callback.code,
          callback.nickName,
          callback.avatarUrl
        );

        if (!result.success) {
          console.error("[MpLoginHandler] exchangeCodeForToken failed:", result.error);
        } else {
          console.log("[MpLoginHandler] exchangeCodeForToken success");
          clearWxMpLoginParams();
          // 刷新页面以加载新会话
          window.location.reload();
        }
        return;
      }
    } catch (err) {
      console.error("[MpLoginHandler] Mini program login callback error:", err);
      clearWxMpLoginParams();
    }
  }, [router]);

  useEffect(() => {
    handleMpLoginCallback();
  }, [handleMpLoginCallback]);

  // 不需要渲染任何内容
  return null;
}
