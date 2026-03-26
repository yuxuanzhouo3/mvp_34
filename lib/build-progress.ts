/**
 * 构建进度阶段定义
 * 用于国内版和国际版的构建进度展示
 */

// 构建阶段枚举
export type BuildStage =
  | "initializing"
  | "downloading"
  | "extracting"
  | "configuring"
  | "processing_privacy"
  | "processing_icons"
  | "packaging"
  | "uploading"
  | "finalizing"
  | "completed"
  | "failed";

// 阶段信息接口
export interface StageInfo {
  stage: BuildStage;
  progress: number;
  label: {
    zh: string;
    en: string;
  };
}

// 各平台的构建阶段定义
export const BUILD_STAGES: Record<string, StageInfo[]> = {
  // Android 构建阶段
  android: [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 10, label: { zh: "下载模板文件", en: "Downloading template" } },
    { stage: "extracting", progress: 25, label: { zh: "解压项目文件", en: "Extracting project files" } },
    { stage: "configuring", progress: 40, label: { zh: "配置应用信息", en: "Configuring app info" } },
    { stage: "processing_privacy", progress: 50, label: { zh: "处理隐私政策", en: "Processing privacy policy" } },
    { stage: "processing_icons", progress: 60, label: { zh: "生成应用图标", en: "Generating app icons" } },
    { stage: "packaging", progress: 80, label: { zh: "打包项目文件", en: "Packaging project" } },
    { stage: "uploading", progress: 90, label: { zh: "上传构建结果", en: "Uploading build result" } },
    { stage: "finalizing", progress: 95, label: { zh: "完成构建记录", en: "Finalizing build record" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],

  // Android APK 构建阶段（使用 GitHub Actions 编译）
  "android-apk": [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 10, label: { zh: "生成Android源码", en: "Generating Android source" } },
    { stage: "extracting", progress: 30, label: { zh: "上传源码到云端", en: "Uploading source to cloud" } },
    { stage: "configuring", progress: 50, label: { zh: "编译APK中", en: "Compiling APK" } },
    { stage: "packaging", progress: 80, label: { zh: "下载构建产物", en: "Downloading build artifact" } },
    { stage: "uploading", progress: 90, label: { zh: "上传APK到云端", en: "Uploading APK to cloud" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],

  // Chrome 扩展构建阶段
  chrome: [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 15, label: { zh: "下载模板文件", en: "Downloading template" } },
    { stage: "extracting", progress: 30, label: { zh: "解压项目文件", en: "Extracting project files" } },
    { stage: "configuring", progress: 50, label: { zh: "配置扩展信息", en: "Configuring extension info" } },
    { stage: "processing_icons", progress: 65, label: { zh: "生成扩展图标", en: "Generating extension icons" } },
    { stage: "packaging", progress: 80, label: { zh: "打包扩展文件", en: "Packaging extension" } },
    { stage: "uploading", progress: 92, label: { zh: "上传构建结果", en: "Uploading build result" } },
    { stage: "finalizing", progress: 96, label: { zh: "完成构建记录", en: "Finalizing build record" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],

  // Windows 应用构建阶段
  windows: [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 12, label: { zh: "下载模板文件", en: "Downloading template" } },
    { stage: "configuring", progress: 35, label: { zh: "配置应用信息", en: "Configuring app info" } },
    { stage: "processing_icons", progress: 55, label: { zh: "生成应用图标", en: "Generating app icons" } },
    { stage: "packaging", progress: 75, label: { zh: "打包应用程序", en: "Packaging application" } },
    { stage: "uploading", progress: 90, label: { zh: "上传构建结果", en: "Uploading build result" } },
    { stage: "finalizing", progress: 96, label: { zh: "完成构建记录", en: "Finalizing build record" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],

  // macOS 应用构建阶段
  macos: [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 10, label: { zh: "下载模板文件", en: "Downloading template" } },
    { stage: "extracting", progress: 25, label: { zh: "解压项目文件", en: "Extracting project files" } },
    { stage: "configuring", progress: 45, label: { zh: "配置应用信息", en: "Configuring app info" } },
    { stage: "processing_icons", progress: 60, label: { zh: "生成应用图标", en: "Generating app icons" } },
    { stage: "packaging", progress: 80, label: { zh: "打包应用程序", en: "Packaging application" } },
    { stage: "uploading", progress: 92, label: { zh: "上传构建结果", en: "Uploading build result" } },
    { stage: "finalizing", progress: 96, label: { zh: "完成构建记录", en: "Finalizing build record" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],

  // Linux 应用构建阶段
  linux: [
    { stage: "initializing", progress: 0, label: { zh: "初始化构建环境", en: "Initializing build environment" } },
    { stage: "downloading", progress: 10, label: { zh: "下载模板文件", en: "Downloading template" } },
    { stage: "extracting", progress: 25, label: { zh: "解压项目文件", en: "Extracting project files" } },
    { stage: "configuring", progress: 45, label: { zh: "配置应用信息", en: "Configuring app info" } },
    { stage: "processing_icons", progress: 60, label: { zh: "生成应用图标", en: "Generating app icons" } },
    { stage: "packaging", progress: 80, label: { zh: "打包应用程序", en: "Packaging application" } },
    { stage: "uploading", progress: 92, label: { zh: "上传构建结果", en: "Uploading build result" } },
    { stage: "finalizing", progress: 96, label: { zh: "完成构建记录", en: "Finalizing build record" } },
    { stage: "completed", progress: 100, label: { zh: "构建完成", en: "Build completed" } },
  ],
};

// 默认阶段（用于未知平台）
export const DEFAULT_STAGES = BUILD_STAGES.android;

/**
 * 获取指定平台的构建阶段
 */
export function getPlatformStages(platform: string): StageInfo[] {
  const normalizedPlatform = platform.toLowerCase();
  return BUILD_STAGES[normalizedPlatform] || DEFAULT_STAGES;
}

/**
 * 根据进度值获取当前阶段信息
 */
export function getStageByProgress(platform: string, progress: number): StageInfo {
  const stages = getPlatformStages(platform);

  // 找到当前进度对应的阶段
  for (let i = stages.length - 1; i >= 0; i--) {
    if (progress >= stages[i].progress) {
      return stages[i];
    }
  }

  return stages[0];
}

/**
 * 获取阶段标签
 */
export function getStageLabel(platform: string, progress: number, language: "zh" | "en" = "zh"): string {
  const stage = getStageByProgress(platform, progress);
  return stage.label[language];
}

/**
 * 计算平滑进度值（用于动画）
 * 在两个阶段之间进行插值，使进度条更平滑
 */
export function getSmoothProgress(platform: string, currentProgress: number, targetProgress: number): number {
  const stages = getPlatformStages(platform);

  // 找到当前和目标阶段
  let currentStageIndex = 0;
  let targetStageIndex = 0;

  for (let i = stages.length - 1; i >= 0; i--) {
    if (currentProgress >= stages[i].progress) {
      currentStageIndex = i;
      break;
    }
  }

  for (let i = stages.length - 1; i >= 0; i--) {
    if (targetProgress >= stages[i].progress) {
      targetStageIndex = i;
      break;
    }
  }

  // 如果在同一阶段内，直接返回目标进度
  if (currentStageIndex === targetStageIndex) {
    return targetProgress;
  }

  // 否则返回下一阶段的起始进度
  return stages[Math.min(currentStageIndex + 1, stages.length - 1)].progress;
}

/**
 * 构建进度更新辅助类
 */
export class BuildProgressHelper {
  private platform: string;
  private stages: StageInfo[];

  constructor(platform: string) {
    this.platform = platform.toLowerCase();
    this.stages = getPlatformStages(this.platform);
  }

  /**
   * 获取指定阶段的进度值
   */
  getProgressForStage(stage: BuildStage): number {
    const stageInfo = this.stages.find(s => s.stage === stage);
    return stageInfo?.progress ?? 0;
  }

  /**
   * 获取阶段信息
   */
  getStageInfo(stage: BuildStage): StageInfo | undefined {
    return this.stages.find(s => s.stage === stage);
  }

  /**
   * 获取所有阶段
   */
  getAllStages(): StageInfo[] {
    return this.stages;
  }
}
