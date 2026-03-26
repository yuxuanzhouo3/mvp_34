/**
 * 国内版微信小程序构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { trackBuildCompleteEvent } from "@/services/analytics";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface WechatBuildConfig {
  url: string;
  appName: string;
  appId: string;
  version: string;
}

export async function processWechatBuildDomestic(
  buildId: string,
  config: WechatBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();

  try {
    // 获取构建记录以获取 user_id
    const buildRecord = await db.collection("builds").doc(buildId).get();
    userId = buildRecord?.data?.[0]?.user_id || null;

    await updateBuildStatus(db, buildId, "processing", 5);

    console.log(`[Domestic Wechat Build ${buildId}] Downloading wechat.zip...`);
    const zipBuffer = await storage.downloadFile("WeChat/wechat.zip");

    await updateBuildStatus(db, buildId, "processing", 20);

    tempDir = path.join(os.tmpdir(), `wechat-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", 35);

    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure");
    }

    // Update project.config.json
    const projectConfigPath = path.join(projectRoot, "project.config.json");
    if (fs.existsSync(projectConfigPath)) {
      const configContent = fs.readFileSync(projectConfigPath, "utf-8");
      const projectConfig = JSON.parse(configContent);
      projectConfig.projectname = config.appName;
      if (config.appId) {
        projectConfig.appid = config.appId;
      }
      fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2), "utf-8");
    }

    // Update app.json
    const appJsonPath = path.join(projectRoot, "app.json");
    if (fs.existsSync(appJsonPath)) {
      const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
      const appJson = JSON.parse(appJsonContent);
      if (appJson.window) {
        appJson.window.navigationBarTitleText = config.appName;
      }
      fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), "utf-8");
    }

    // Update appConfig.json if exists
    const configPath = path.join(projectRoot, "appConfig.json");
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const appConfig = JSON.parse(configContent);
      if (appConfig.general) {
        appConfig.general.initialUrl = config.url;
        appConfig.general.appName = config.appName;
      }
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
    }

    await updateBuildStatus(db, buildId, "processing", 70);

    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", 85);

    const outputPath = `user-builds/builds/${buildId}/wechat-miniprogram.zip`;
    await storage.uploadFile(outputPath, outputBuffer);

    const downloadUrl = await storage.getTempDownloadUrl(outputPath);

    await db.collection("builds").doc(buildId).update({
      status: "completed",
      progress: 100,
      output_file_path: outputPath,
      download_url: downloadUrl,
      file_size: outputBuffer.length,
      updated_at: new Date().toISOString(),
    });

    console.log(`[Domestic Wechat Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "wechat",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic Wechat Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic Wechat Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "wechat",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic Wechat Build ${buildId}] Failed to track build failure event:`, err);
      });
    }
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  }
}

async function updateBuildStatus(db: any, buildId: string, status: string, progress: number): Promise<void> {
  await db.collection("builds").doc(buildId).update({
    status,
    progress,
    updated_at: new Date().toISOString(),
  });
}

function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  const projectConfigPath = path.join(dir, "project.config.json");
  const appJsonPath = path.join(dir, "app.json");
  if (fs.existsSync(projectConfigPath) || fs.existsSync(appJsonPath)) return dir;

  if (maxDepth <= 0) return null;

  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const result = findProjectRoot(itemPath, maxDepth - 1);
        if (result) return result;
      }
    }
  } catch { /* ignore */ }

  return null;
}

function addFolderToZip(zip: AdmZip, folderPath: string, zipPath: string): void {
  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    const itemZipPath = zipPath ? `${zipPath}/${item}` : item;
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      addFolderToZip(zip, itemPath, itemZipPath);
    } else {
      const fileContent = fs.readFileSync(itemPath);
      zip.addFile(itemZipPath, fileContent);
    }
  }
}
