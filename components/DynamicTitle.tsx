"use client";

import { useEffect } from "react";
import { IS_DOMESTIC_VERSION } from "@/config";
import { isMiniProgram } from "@/lib/wechat-mp";

const MINIPROGRAM_TITLE = "晨佑端转化工具";

/**
 * 动态设置网页标题
 * 国内版小程序环境显示"晨佑端转化工具"
 * 其他情况保持 metadata 中的默认标题
 */
export function DynamicTitle() {
  useEffect(() => {
    // 仅国内版需要处理
    if (!IS_DOMESTIC_VERSION) return;

    const updateTitle = () => {
      // 检测是否在小程序环境
      if (isMiniProgram()) {
        document.title = MINIPROGRAM_TITLE;
      }
    };

    // 使用 requestAnimationFrame 确保在渲染完成后设置标题
    // 多次调用以覆盖其他可能的标题设置
    const setTitleWithDelay = () => {
      updateTitle();
      requestAnimationFrame(() => {
        updateTitle();
        // 再次延迟确保覆盖
        setTimeout(updateTitle, 100);
      });
    };

    // 立即执行
    setTitleWithDelay();
  }, []);

  return null;
}
