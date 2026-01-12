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

    try {
      // 构建完整的 fileID
      // 格式: cloud://envId.bucketId/path
      const envId = process.env.WECHAT_CLOUDBASE_ID;
      const bucketId = process.env.CLOUDBASE_BUCKET_ID || `6d6f-${envId}-1389815466`;
      const fileID = `cloud://${envId}.${bucketId}/${cloudPath}`;

      // 获取临时下载链接
      const { fileList } = await this.app.getTempFileURL({
        fileList: [fileID],
      });

      if (!fileList || fileList.length === 0 || !fileList[0].tempFileURL) {
        throw new Error(`File not found: ${cloudPath}`);
      }

      const tempUrl = fileList[0].tempFileURL;

      // 下载文件
      const response = await fetch(tempUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`[CloudBase Storage] Download error for ${cloudPath}:`, error);
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
      console.error(`[CloudBase Storage] Get temp URL error for ${cloudPath}:`, error);
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
