/**
 * 图标上传配置
 * 通过环境变量 MAX_IMAGE_UPLOAD_MB 控制上传大小限制
 * 设置为 0 表示禁用图标上传功能
 */

// 获取最大上传大小（MB），默认 5MB
export function getMaxImageUploadMB(): number {
  const envValue = process.env.MAX_IMAGE_UPLOAD_MB;
  if (envValue === undefined || envValue === "") {
    return 5; // 默认 5MB
  }
  const parsed = parseFloat(envValue);
  return isNaN(parsed) ? 5 : parsed;
}

// 获取最大上传大小（字节）
export function getMaxImageUploadBytes(): number {
  return getMaxImageUploadMB() * 1024 * 1024;
}

// 检查图标上传是否启用
export function isIconUploadEnabled(): boolean {
  return getMaxImageUploadMB() > 0;
}

// 验证文件大小是否在限制内
export function validateImageSize(fileSize: number): {
  valid: boolean;
  maxSizeMB: number;
  fileSizeMB: number;
} {
  const maxSizeMB = getMaxImageUploadMB();
  const fileSizeMB = fileSize / (1024 * 1024);

  return {
    valid: maxSizeMB > 0 && fileSize <= maxSizeMB * 1024 * 1024,
    maxSizeMB,
    fileSizeMB: Math.round(fileSizeMB * 100) / 100,
  };
}

// 导出配置对象（用于前端 API 响应）
export function getUploadConfig() {
  const maxSizeMB = getMaxImageUploadMB();
  return {
    maxImageUploadMB: maxSizeMB,
    maxImageUploadBytes: maxSizeMB * 1024 * 1024,
    iconUploadEnabled: maxSizeMB > 0,
  };
}
