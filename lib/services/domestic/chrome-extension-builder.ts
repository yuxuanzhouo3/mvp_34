/**
 * 国内版 Chrome 扩展构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { BuildProgressHelper } from "@/lib/build-progress";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface ChromeExtensionBuildConfig {
  url: string;
  appName: string;
  versionName: string;
  description: string;
  iconPath: string | null;
}

export async function processChromeExtensionBuildDomestic(
  buildId: string,
  config: ChromeExtensionBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;
  const progressHelper = new BuildProgressHelper("chrome");

  try {
    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("initializing"));

    console.log(`[Domestic Chrome Build ${buildId}] Downloading googleplugin.zip...`);
    const zipBuffer = await storage.downloadFile("GooglePlugin/googleplugin.zip");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("downloading"));

    tempDir = path.join(os.tmpdir(), `chrome-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("extracting"));

    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure");
    }

    // Update manifest.json
    const manifestPath = path.join(projectRoot, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);
      manifest.name = config.appName;
      manifest.version = config.versionName;
      manifest.description = config.description || manifest.description;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
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

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("configuring"));

    if (config.iconPath) {
      try {
        const iconBuffer = await storage.downloadFile(config.iconPath);
        await processIcons(projectRoot, iconBuffer);
      } catch (iconError) {
        console.error(`[Domestic Chrome Build ${buildId}] Icon processing failed:`, iconError);
      }
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_icons"));

    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    const outputPath = `user-builds/builds/${buildId}/chrome-extension.zip`;
    await storage.uploadFile(outputPath, outputBuffer);

    const downloadUrl = await storage.getTempDownloadUrl(outputPath);

    await db.collection("builds").doc(buildId).update({
      status: "completed",
      progress: progressHelper.getProgressForStage("completed"),
      output_file_path: outputPath,
      download_url: downloadUrl,
      file_size: outputBuffer.length,
      updated_at: new Date().toISOString(),
    });

    console.log(`[Domestic Chrome Build ${buildId}] Completed successfully!`);
  } catch (error) {
    console.error(`[Domestic Chrome Build ${buildId}] Error:`, error);

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
  const manifestPath = path.join(dir, "manifest.json");
  if (fs.existsSync(manifestPath)) return dir;

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
  const sizes = [16, 32, 48, 128];
  const iconsDir = path.join(projectRoot, "icons");

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(iconBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(iconPath);
  }
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
