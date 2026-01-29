/**
 * 国内版 Android 构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { BuildProgressHelper } from "@/lib/build-progress";
import { trackBuildCompleteEvent } from "@/services/analytics";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface BuildConfig {
  url: string;
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  iconPath: string | null;
}

// Icon sizes for Android
const APP_ICON_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

const APP_ICON_FOREGROUND_SIZES = [
  { folder: "mipmap-mdpi", size: 108 },
  { folder: "mipmap-hdpi", size: 162 },
  { folder: "mipmap-xhdpi", size: 216 },
  { folder: "mipmap-xxhdpi", size: 324 },
  { folder: "mipmap-xxxhdpi", size: 432 },
];

const SPLASH_ICON_SIZES = [
  { folder: "drawable-mdpi", size: 180 },
  { folder: "drawable-hdpi", size: 270 },
  { folder: "drawable-xhdpi", size: 360 },
  { folder: "drawable-xxhdpi", size: 540 },
  { folder: "drawable-xxxhdpi", size: 720 },
];

const SPLASH_NIGHT_ICON_SIZES = [
  { folder: "drawable-night-mdpi", size: 180 },
  { folder: "drawable-night-hdpi", size: 270 },
  { folder: "drawable-night-xhdpi", size: 360 },
  { folder: "drawable-night-xxhdpi", size: 540 },
  { folder: "drawable-night-xxxhdpi", size: 720 },
];

const SIDEBAR_LOGO_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

const SIDEBAR_LOGO_NIGHT_SIZES = [
  { folder: "mipmap-night-mdpi", size: 48 },
  { folder: "mipmap-night-hdpi", size: 72 },
  { folder: "mipmap-night-xhdpi", size: 96 },
  { folder: "mipmap-night-xxhdpi", size: 144 },
  { folder: "mipmap-night-xxxhdpi", size: 192 },
];

const ACTIONBAR_ICON_SIZES = [
  { folder: "drawable-mdpi", size: 24 },
  { folder: "drawable-hdpi", size: 36 },
  { folder: "drawable-xhdpi", size: 48 },
  { folder: "drawable-xxhdpi", size: 72 },
  { folder: "drawable-xxxhdpi", size: 96 },
];

const ACTIONBAR_NIGHT_ICON_SIZES = [
  { folder: "drawable-night-mdpi", size: 24 },
  { folder: "drawable-night-hdpi", size: 36 },
  { folder: "drawable-night-xhdpi", size: 48 },
  { folder: "drawable-night-xxhdpi", size: 72 },
  { folder: "drawable-night-xxxhdpi", size: 96 },
];

export async function processAndroidBuildDomestic(
  buildId: string,
  config: BuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();
  const progressHelper = new BuildProgressHelper("android");

  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();

  try {
    // 获取构建记录以获取 user_id
    const buildRecord = await db.collection("builds").doc(buildId).get();
    userId = buildRecord?.data?.[0]?.user_id || null;

    // Update status to processing
    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("initializing"));

    // Step 1: Download android.zip from CloudBase Storage
    console.log(`[Domestic Build ${buildId}] Downloading android.zip...`);
    const zipBuffer = await storage.downloadFile("Android/android.zip");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("downloading"));

    // Step 2: Extract zip to temp directory
    console.log(`[Domestic Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `android-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("extracting"));

    // Step 2.5: Find the actual project root
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find 'app' directory");
    }
    console.log(`[Domestic Build ${buildId}] Project root found: ${projectRoot}`);

    // Step 3: Update config file
    console.log(`[Domestic Build ${buildId}] Updating config...`);
    const assetsDir = path.join(projectRoot, "app", "src", "main", "assets");

    if (!fs.existsSync(assetsDir)) {
      throw new Error(`Assets directory not found: ${assetsDir}`);
    }

    const configPath = path.join(assetsDir, "appConfig.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    await updateAppConfig(configPath, config);

    // Step 3.5: Update AndroidManifest.xml version
    console.log(`[Domestic Build ${buildId}] Updating AndroidManifest.xml...`);
    const manifestPath = path.join(projectRoot, "app", "src", "main", "AndroidManifest.xml");
    if (fs.existsSync(manifestPath)) {
      await updateAndroidManifest(manifestPath, config);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("configuring"));

    // Step 4: Update privacy policy
    console.log(`[Domestic Build ${buildId}] Updating privacy policy...`);
    const privacyPathMd = path.join(assetsDir, "privacy_policy.md");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPathMd, config.privacyPolicy, "utf-8");
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_privacy"));

    // Step 5: Process icons if provided
    if (config.iconPath) {
      console.log(`[Domestic Build ${buildId}] Processing icons...`);
      try {
        const iconBuffer = await storage.downloadFile(config.iconPath);
        await processIcons(projectRoot, iconBuffer, buildId);
        console.log(`[Domestic Build ${buildId}] Icon processing completed`);
      } catch (iconError) {
        console.error(`[Domestic Build ${buildId}] Icon processing failed:`, iconError);
      }
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_icons"));

    // Step 6: Repack zip
    console.log(`[Domestic Build ${buildId}] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    // Step 7: Upload result to CloudBase Storage
    console.log(`[Domestic Build ${buildId}] Uploading result...`);
    const outputPath = `user-builds/builds/${buildId}/android-source.zip`;
    await storage.uploadFile(outputPath, outputBuffer);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("uploading"));

    // Step 8: Get download URL and update build record
    const downloadUrl = await storage.getTempDownloadUrl(outputPath);

    await db.collection("builds").doc(buildId).update({
      status: "completed",
      progress: progressHelper.getProgressForStage("completed"),
      output_file_path: outputPath,
      download_url: downloadUrl,
      file_size: outputBuffer.length,
      updated_at: new Date().toISOString(),
    });

    console.log(`[Domestic Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "android",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "android",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic Build ${buildId}] Failed to track build failure event:`, err);
      });
    }
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`[Domestic Build ${buildId}] Failed to cleanup temp dir:`, cleanupError);
      }
    }
  }
}

async function updateBuildStatus(
  db: any,
  buildId: string,
  status: string,
  progress: number
): Promise<void> {
  await db.collection("builds").doc(buildId).update({
    status,
    progress,
    updated_at: new Date().toISOString(),
  });
}

function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  const appDir = path.join(dir, "app");
  if (fs.existsSync(appDir) && fs.statSync(appDir).isDirectory()) {
    const mainDir = path.join(appDir, "src", "main");
    if (fs.existsSync(mainDir)) {
      return dir;
    }
  }

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

async function updateAppConfig(configPath: string, config: BuildConfig): Promise<void> {
  const configContent = fs.readFileSync(configPath, "utf-8");
  const appConfig = JSON.parse(configContent);

  if (appConfig.general) {
    appConfig.general.initialUrl = config.url;
    appConfig.general.appName = config.appName;
    appConfig.general.androidPackageName = config.packageName;
    appConfig.general.androidVersionName = config.versionName;
    appConfig.general.androidVersionCode = parseInt(config.versionCode, 10) || 1;
  }

  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
}

async function updateAndroidManifest(manifestPath: string, config: BuildConfig): Promise<void> {
  let manifestContent = fs.readFileSync(manifestPath, "utf-8");
  manifestContent = manifestContent.replace(
    /android:versionName="[^"]*"/,
    `android:versionName="${config.versionName}"`
  );
  fs.writeFileSync(manifestPath, manifestContent, "utf-8");
}

async function processIcons(projectRoot: string, iconBuffer: Buffer, buildId: string): Promise<void> {
  const resDir = path.join(projectRoot, "app", "src", "main", "res");

  if (!fs.existsSync(resDir)) {
    throw new Error(`Res directory not found: ${resDir}`);
  }

  // Normalize icon to 1024x1024
  const normalizedBuffer = await sharp(iconBuffer)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const processIcon = async (folder: string, size: number, fileName: string) => {
    const iconDir = path.join(resDir, folder);
    const outputPath = path.join(iconDir, fileName);

    if (!fs.existsSync(iconDir)) return;

    await sharp(normalizedBuffer).resize(size, size).png().toFile(outputPath);
  };

  const processForegroundIcon = async (folder: string, size: number, fileName: string) => {
    const iconDir = path.join(resDir, folder);
    const outputPath = path.join(iconDir, fileName);

    if (!fs.existsSync(iconDir)) return;

    const safeSize = Math.round(size * 0.61);
    const padding = Math.round((size - safeSize) / 2);

    await sharp(normalizedBuffer)
      .resize(safeSize, safeSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);
  };

  // Process all icon types
  for (const { folder, size } of APP_ICON_SIZES) {
    await processIcon(folder, size, "ic_launcher.png");
  }

  for (const { folder, size } of APP_ICON_FOREGROUND_SIZES) {
    await processForegroundIcon(folder, size, "ic_launcher_foreground.png");
  }

  for (const { folder, size } of SPLASH_ICON_SIZES) {
    await processForegroundIcon(folder, size, "splash.png");
  }

  for (const { folder, size } of SPLASH_NIGHT_ICON_SIZES) {
    await processForegroundIcon(folder, size, "splash.png");
  }

  for (const { folder, size } of SIDEBAR_LOGO_SIZES) {
    await processIcon(folder, size, "ic_sidebar_logo.png");
  }

  for (const { folder, size } of SIDEBAR_LOGO_NIGHT_SIZES) {
    await processIcon(folder, size, "ic_sidebar_logo.png");
  }

  for (const { folder, size } of ACTIONBAR_ICON_SIZES) {
    await processIcon(folder, size, "ic_actionbar.png");
  }

  for (const { folder, size } of ACTIONBAR_NIGHT_ICON_SIZES) {
    await processIcon(folder, size, "ic_actionbar.png");
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
