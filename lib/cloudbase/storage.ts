/**
 * CloudBase 云存储服务（国内版）
 * 提供文件上传、下载、删除等功能
 */

import { CloudBaseConnector } from "./connector";

export class CloudBaseStorage {
  private app: any = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    this.app = connector.getApp();
    this.initialized = true;
  }

  private ensureReady() {
    if (!this.app || !this.initialized) {
      throw new Error("CloudBase storage not initialized");
    }
  }

  /**
   * 下载文件
   * @param cloudPath 云存储路径，如 "templates/android.zip"
   * @returns Buffer
   */
  async downloadFile(cloudPath: string): Promise<Buffer> {
    await this.initialize();
    this.ensureReady();

    console.log(`[CloudBase Storage] ========== DOWNLOAD START ==========`);
    console.log(`[CloudBase Storage] Requested path: ${cloudPath}`);

    try {
      // 构建完整的 fileID
      // 格式: cloud://envId.bucketId/path
      const envId = process.env.WECHAT_CLOUDBASE_ID;
      const bucketId = process.env.CLOUDBASE_BUCKET_ID || `6d6f-${envId}-1389815466`;
      const fileID = `cloud://${envId}.${bucketId}/${cloudPath}`;

      console.log(`[CloudBase Storage] Environment ID: ${envId}`);
      console.log(`[CloudBase Storage] Bucket ID: ${bucketId}`);
      console.log(`[CloudBase Storage] Constructed fileID: ${fileID}`);

      // 获取临时下载链接
      console.log(`[CloudBase Storage] Requesting temp download URL...`);
      const { fileList } = await this.app.getTempFileURL({
        fileList: [fileID],
      });

      console.log(`[CloudBase Storage] getTempFileURL response:`, JSON.stringify(fileList, null, 2));

      if (!fileList || fileList.length === 0) {
        throw new Error(`File not found: ${cloudPath} (fileID: ${fileID}) - fileList is empty`);
      }

      if (!fileList[0].tempFileURL) {
        const errorMsg = fileList[0].errMsg || fileList[0].status || "Unknown error";
        throw new Error(`File not found: ${cloudPath} (fileID: ${fileID}) - Error: ${errorMsg}`);
      }

      const tempUrl = fileList[0].tempFileURL;
      console.log(`[CloudBase Storage] ✓ Temp URL obtained: ${tempUrl.substring(0, 100)}...`);

      // 下载文件（带超时和重试）
      console.log(`[CloudBase Storage] Downloading file from temp URL...`);

      const downloadWithRetry = async (url: string, maxRetries = 3): Promise<Response> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[CloudBase Storage] Download attempt ${attempt}/${maxRetries}...`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

            const response = await fetch(url, {
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
          } catch (error) {
            console.error(`[CloudBase Storage] Attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));

            if (attempt === maxRetries) {
              throw error;
            }

            // 等待后重试（指数退避）
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`[CloudBase Storage] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        throw new Error("Download failed after all retries");
      };

      const response = await downloadWithRetry(tempUrl);

      console.log(`[CloudBase Storage] Fetch response status: ${response.status} ${response.statusText}`);
      console.log(`[CloudBase Storage] Response headers:`, Object.fromEntries(response.headers.entries()));

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[CloudBase Storage] ✓ File downloaded successfully`);
      console.log(`[CloudBase Storage] Buffer size: ${buffer.length} bytes`);
      console.log(`[CloudBase Storage] ========== DOWNLOAD END ==========`);

      return buffer;
    } catch (error) {
      console.error(`[CloudBase Storage] ========== DOWNLOAD FAILED ==========`);
      console.error(`[CloudBase Storage] Path: ${cloudPath}`);
      console.error(`[CloudBase Storage] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`[CloudBase Storage] Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[CloudBase Storage] Error stack:`, error instanceof Error ? error.stack : "No stack trace");
      console.error(`[CloudBase Storage] ==========================================`);
      throw error;
    }
  }

  /**
   * 上传文件
   * @param cloudPath 云存储路径，如 "builds/xxx/android-source.zip"
   * @param fileBuffer 文件内容
   * @returns 上传后的文件ID
   */
  async uploadFile(cloudPath: string, fileBuffer: Buffer): Promise<string> {
    await this.initialize();
    this.ensureReady();

    try {
      const result = await this.app.uploadFile({
        cloudPath,
        fileContent: fileBuffer,
      });

      if (!result.fileID) {
        throw new Error("Upload failed: no fileID returned");
      }

      return result.fileID;
    } catch (error) {
      console.error(`[CloudBase Storage] Upload error for ${cloudPath}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件临时下载链接
   * @param cloudPath 云存储路径
   * @returns 临时下载URL
   */
  async getTempDownloadUrl(cloudPath: string): Promise<string> {
    await this.initialize();
    this.ensureReady();

    try {
      // 构建完整的 fileID
      // 格式: cloud://envId.bucketId/path
      const envId = process.env.WECHAT_CLOUDBASE_ID;
      const bucketId = process.env.CLOUDBASE_BUCKET_ID || `6d6f-${envId}-1389815466`;
      const fileID = cloudPath.startsWith("cloud://")
        ? cloudPath
        : `cloud://${envId}.${bucketId}/${cloudPath}`;

      const { fileList } = await this.app.getTempFileURL({
        fileList: [fileID],
      });

      if (!fileList || fileList.length === 0 || !fileList[0].tempFileURL) {
        throw new Error(`Failed to get temp URL for: ${cloudPath}`);
      }

      return fileList[0].tempFileURL;
    } catch (error) {
      // 只记录错误类型，不打印完整错误信息（减少日志噪音）
      console.error(`[CloudBase Storage] Get temp URL error for ${cloudPath}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 删除文件
   * @param cloudPath 云存储路径
   */
  async deleteFile(cloudPath: string): Promise<void> {
    await this.initialize();
    this.ensureReady();

    try {
      // 构建完整的 fileID
      // 格式: cloud://envId.bucketId/path
      const envId = process.env.WECHAT_CLOUDBASE_ID;
      const bucketId = process.env.CLOUDBASE_BUCKET_ID || `6d6f-${envId}-1389815466`;
      const fileID = cloudPath.startsWith("cloud://")
        ? cloudPath
        : `cloud://${envId}.${bucketId}/${cloudPath}`;

      await this.app.deleteFile({
        fileList: [fileID],
      });
    } catch (error) {
      console.error(`[CloudBase Storage] Delete error for ${cloudPath}:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param cloudPath 云存储路径
   */
  async fileExists(cloudPath: string): Promise<boolean> {
    try {
      await this.getTempDownloadUrl(cloudPath);
      return true;
    } catch {
      return false;
    }
  }
}

// 单例实例
let storageInstance: CloudBaseStorage | null = null;

export function getCloudBaseStorage(): CloudBaseStorage {
  if (!storageInstance) {
    storageInstance = new CloudBaseStorage();
  }
  return storageInstance;
}
