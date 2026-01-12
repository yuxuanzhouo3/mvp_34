/**
 * 国内版 HarmonyOS 构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface HarmonyOSBuildConfig {
  url: string;
  appName: string;
  bundleName: string;
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  iconPath: string | null;
}

export async function processHarmonyOSBuildDomestic(
  buildId: string,
  config: HarmonyOSBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;

  try {
    await updateBuildStatus(db, buildId, "processing", 5);

    console.log(`[Domestic HarmonyOS Build ${buildId}] Downloading harmonyos.zip...`);
    const zipBuffer = await storage.downloadFile("HarmonyOS/harmonyos.zip");

    await updateBuildStatus(db, buildId, "processing", 20);

    tempDir = path.join(os.tmpdir(), `harmonyos-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", 35);

    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure");
    }

    // Update appConfig.json
    const configPath = path.join(projectRoot, "appConfig.json");
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const appConfig = JSON.parse(configContent);
      if (appConfig.general) {
        appConfig.general.initialUrl = config.url;
        appConfig.general.appName = config.appName;
        appConfig.general.harmonyBundleName = config.bundleName;
        appConfig.general.harmonyVersionName = config.versionName;
        appConfig.general.harmonyVersionCode = parseInt(config.versionCode, 10) || 1;
      }
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
    }

    // Update app.json5 if exists
    const appJson5Path = path.join(projectRoot, "AppScope", "app.json5");
    if (fs.existsSync(appJson5Path)) {
      let content = fs.readFileSync(appJson5Path, "utf-8");
      content = content.replace(/"bundleName"\s*:\s*"[^"]*"/, `"bundleName": "${config.bundleName}"`);
      content = content.replace(/"versionName"\s*:\s*"[^"]*"/, `"versionName": "${config.versionName}"`);
      content = content.replace(/"versionCode"\s*:\s*\d+/, `"versionCode": ${parseInt(config.versionCode, 10) || 1}`);
      fs.writeFileSync(appJson5Path, content, "utf-8");
    }

    await updateBuildStatus(db, buildId, "processing", 50);

    // Update privacy policy
    const privacyPath = path.join(projectRoot, "entry", "src", "main", "resources", "rawfile", "privacy_policy.md");
    if (config.privacyPolicy && fs.existsSync(path.dirname(privacyPath))) {
      fs.writeFileSync(privacyPath, config.privacyPolicy, "utf-8");
    }

    await updateBuildStatus(db, buildId, "processing", 60);

    if (config.iconPath) {
      try {
        const iconBuffer = await storage.downloadFile(config.iconPath);
        await processIcons(projectRoot, iconBuffer);
      } catch (iconError) {
        console.error(`[Domestic HarmonyOS Build ${buildId}] Icon processing failed:`, iconError);
      }
    }

    await updateBuildStatus(db, buildId, "processing", 75);

    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", 85);

    const outputPath = `user-builds/builds/${buildId}/harmonyos-source.zip`;
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

    console.log(`[Domestic HarmonyOS Build ${buildId}] Completed successfully!`);
  } catch (error) {
    console.error(`[Domestic HarmonyOS Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });
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
  const appJson5Path = path.join(dir, "AppScope", "app.json5");
  const configPath = path.join(dir, "appConfig.json");
  if (fs.existsSync(appJson5Path) || fs.existsSync(configPath)) return dir;

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

async function processIcons(projectRoot: string, iconBuffer: Buffer): Promise<void> {
  const mediaDir = path.join(projectRoot, "entry", "src", "main", "resources", "base", "media");

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // App icon
  const iconPath = path.join(mediaDir, "app_icon.png");
  await sharp(iconBuffer)
    .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(iconPath);

  // Foreground icon
  const foregroundPath = path.join(mediaDir, "foreground.png");
  await sharp(iconBuffer)
    .resize(288, 288, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(foregroundPath);
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
