"use client";

import { useEffect, useState, useRef } from "react";
import { getStageByProgress, getPlatformStages, type StageInfo } from "@/lib/build-progress";
import { cn } from "@/lib/utils";

interface BuildProgressBarProps {
  progress: number;
  platform: string;
  status: "pending" | "processing" | "completed" | "failed";
  language?: "zh" | "en";
  className?: string;
  showSteps?: boolean;
}

export function BuildProgressBar({
  progress,
  platform,
  status,
  language = "zh",
  className,
  showSteps = false,
}: BuildProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<StageInfo | null>(null);
  const animationRef = useRef<number | null>(null);
  const prevProgressRef = useRef(0);

  // 平滑动画更新进度
  useEffect(() => {
    const targetProgress = progress;
    const startProgress = prevProgressRef.current;

    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // 如果进度没变化，不需要动画
    if (startProgress === targetProgress) {
      return;
    }

    const duration = 500; // 动画持续时间 500ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);

      // 使用 easeOutCubic 缓动函数
      const easeOut = 1 - Math.pow(1 - progressRatio, 3);
      const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;

      setDisplayProgress(Math.round(currentProgress));

      if (progressRatio < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevProgressRef.current = targetProgress;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [progress]);

  // 更新当前阶段
  useEffect(() => {
    const stage = getStageByProgress(platform, displayProgress);
    setCurrentStage(stage);
  }, [displayProgress, platform]);

  // 获取所有阶段用于步骤显示
  const stages = getPlatformStages(platform);

  // 根据状态获取进度条颜色
  const getProgressBarColor = () => {
    if (status === "failed") {
      return "from-red-500 to-red-600";
    }
    if (status === "completed") {
      return "from-green-500 to-emerald-500";
    }
    return "from-cyan-500 to-blue-500";
  };

  // 根据状态获取背景动画
  const getBackgroundAnimation = () => {
    if (status === "processing") {
      return "animate-pulse";
    }
    return "";
  };

  return (
    <div className={cn("w-full", className)}>
      {/* 进度条 */}
      <div className="relative">
        <div className={cn(
          "h-2 w-full rounded-full bg-muted overflow-hidden",
          getBackgroundAnimation()
        )}>
          {/* 进度填充 */}
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-100 ease-out",
              getProgressBarColor()
            )}
            style={{ width: `${displayProgress}%` }}
          />

          {/* 流光效果 - 仅在处理中显示 */}
          {status === "processing" && displayProgress < 100 && (
            <div
              className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
              style={{
                left: `${Math.max(0, displayProgress - 10)}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* 进度信息 */}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-muted-foreground truncate max-w-[70%]">
          {currentStage?.label[language] || (language === "zh" ? "准备中..." : "Preparing...")}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {displayProgress}%
        </p>
      </div>

      {/* 步骤指示器 - 可选显示 */}
      {showSteps && (
        <div className="mt-3 flex items-center justify-between">
          {stages.slice(0, -1).map((stage, index) => {
            const isCompleted = displayProgress >= stage.progress;
            const isCurrent = currentStage?.stage === stage.stage;

            return (
              <div key={stage.stage} className="flex flex-col items-center flex-1">
                {/* 步骤点 */}
                <div className="relative flex items-center w-full">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full border-2 transition-all duration-300 z-10",
                      isCompleted
                        ? "bg-cyan-500 border-cyan-500"
                        : isCurrent
                        ? "bg-white border-cyan-500 animate-pulse"
                        : "bg-muted border-muted-foreground/30"
                    )}
                  />
                  {/* 连接线 */}
                  {index < stages.length - 2 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 transition-all duration-300",
                        displayProgress >= stages[index + 1]?.progress
                          ? "bg-cyan-500"
                          : "bg-muted-foreground/20"
                      )}
                    />
                  )}
                </div>
                {/* 步骤标签 - 仅显示关键步骤 */}
                {(index === 0 || index === Math.floor(stages.length / 2) || index === stages.length - 2) && (
                  <span className="text-[10px] text-muted-foreground mt-1 text-center truncate max-w-[60px]">
                    {stage.label[language].split(" ")[0]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 简化版进度条 - 用于列表视图
export function BuildProgressBarCompact({
  progress,
  platform,
  status,
  language = "zh",
  className,
}: Omit<BuildProgressBarProps, "showSteps">) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<StageInfo | null>(null);
  const animationRef = useRef<number | null>(null);
  const prevProgressRef = useRef(0);

  // 平滑动画更新进度
  useEffect(() => {
    const targetProgress = progress;
    const startProgress = prevProgressRef.current;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (startProgress === targetProgress) {
      return;
    }

    const duration = 400;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progressRatio, 3);
      const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;

      setDisplayProgress(Math.round(currentProgress));

      if (progressRatio < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevProgressRef.current = targetProgress;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [progress]);

  useEffect(() => {
    const stage = getStageByProgress(platform, displayProgress);
    setCurrentStage(stage);
  }, [displayProgress, platform]);

  const getProgressBarColor = () => {
    if (status === "failed") return "from-red-500 to-red-600";
    if (status === "completed") return "from-green-500 to-emerald-500";
    return "from-cyan-500 to-blue-500";
  };

  return (
    <div className={cn("w-full max-w-xs", className)}>
      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-100",
            getProgressBarColor()
          )}
          style={{ width: `${displayProgress}%` }}
        />
        {status === "processing" && displayProgress < 100 && (
          <div
            className="absolute top-0 h-full w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer"
            style={{ left: `${Math.max(0, displayProgress - 8)}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-muted-foreground truncate max-w-[75%]">
          {currentStage?.label[language] || (language === "zh" ? "准备中" : "Preparing")}
        </p>
        <span className="text-xs font-medium text-muted-foreground">
          {displayProgress}%
        </span>
      </div>
    </div>
  );
}
