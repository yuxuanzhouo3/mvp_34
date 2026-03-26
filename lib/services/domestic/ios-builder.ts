/**
 * 国内版 iOS 构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { trackBuildCompleteEvent } from "@/services/analytics";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface iOSBuildConfig {
  url: string;
  appName: string;
  bundleId: string;
  versionString: string;
  buildNumber: string;
  privacyPolicy: string;
  iconPath: string | null;
}

const IOS_APP_ICON_SIZES = [
  { name: "icon-29.png", size: 29 },
  { name: "icon-40.png", size: 40 },
  { name: "icon-58.png", size: 58 },
  { name: "icon-76.png", size: 76 },
  { name: "icon-80.png", size: 80 },
  { name: "icon-120.png", size: 120 },
  { name: "icon-152.png", size: 152 },
  { name: "icon-167.png", size: 167 },
  { name: "icon-180.png", size: 180 },
  { name: "icon-1024.png", size: 1024 },
];

const IOS_LAUNCH_CENTER_SIZES = [
  { name: "2x.png", size: 200 },
  { name: "2xDark.png", size: 200 },
];

const IOS_HEADER_IMAGE_SIZES = [
  { name: "header.png", size: 60 },
  { name: "header@2x.png", size: 120 },
  { name: "header@3x.png", size: 180 },
  { name: "headerDark.png", size: 60 },
  { name: "headerDark@2x.png", size: 120 },
  { name: "headerDark@3x.png", size: 180 },
];

export async function processiOSBuildDomestic(
  buildId: string,
  config: iOSBuildConfig
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

    // Step 1: Download ios.zip from CloudBase Storage
    console.log(`[Domestic iOS Build ${buildId}] Downloading ios.zip...`);
    const zipBuffer = await storage.downloadFile("iOS/ios.zip");

    await updateBuildStatus(db, buildId, "processing", 15);

    // Step 2: Extract zip
    console.log(`[Domestic iOS Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `ios-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", 25);

    // Step 2.5: Find project root
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find 'LeanIOS' directory");
    }

    // Step 3: Update appConfig.json
    console.log(`[Domestic iOS Build ${buildId}] Updating appConfig.json...`);
    const configPath = path.join(projectRoot, "LeanIOS", "appConfig.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    await updateAppConfig(configPath, config);

    await updateBuildStatus(db, buildId, "processing", 35);

    // Step 4: Update project.pbxproj
    const pbxprojPath = findPbxprojFile(projectRoot);
    if (pbxprojPath) {
      await updatePbxproj(pbxprojPath, config);
    }

    await updateBuildStatus(db, buildId, "processing", 45);

    // Step 5: Update privacy policy
    const leanIOSDir = path.join(projectRoot, "LeanIOS");
    const privacyPathMd = path.join(leanIOSDir, "privacy_policy.md");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPathMd, config.privacyPolicy, "utf-8");
    }

    await updateBuildStatus(db, buildId, "processing", 55);

    // Step 6: Process icons
    if (config.iconPath) {
      console.log(`[Domestic iOS Build ${buildId}] ========== ICON PROCESSING START ==========`);
      console.log(`[Domestic iOS Build ${buildId}] Icon path: ${config.iconPath}`);
      console.log(`[Domestic iOS Build ${buildId}] Project root: ${projectRoot}`);

      try {
        console.log(`[Domestic iOS Build ${buildId}] Attempting to download icon from CloudBase Storage...`);
        const iconBuffer = await storage.downloadFile(config.iconPath);
        console.log(`[Domestic iOS Build ${buildId}] ✓ Icon downloaded successfully`);
        console.log(`[Domestic iOS Build ${buildId}] Icon buffer size: ${iconBuffer.length} bytes`);

        if (!iconBuffer || iconBuffer.length === 0) {
          throw new Error("Downloaded icon buffer is empty");
        }

        console.log(`[Domestic iOS Build ${buildId}] Starting icon processing...`);
        await processIcons(projectRoot, iconBuffer, buildId);
        console.log(`[Domestic iOS Build ${buildId}] ✓ Icon processing completed successfully`);
        console.log(`[Domestic iOS Build ${buildId}] ========== ICON PROCESSING END ==========`);
      } catch (iconError) {
        console.error(`[Domestic iOS Build ${buildId}] ========== ICON PROCESSING FAILED ==========`);
        console.error(`[Domestic iOS Build ${buildId}] Error type: ${iconError instanceof Error ? iconError.constructor.name : typeof iconError}`);
        console.error(`[Domestic iOS Build ${buildId}] Error message: ${iconError instanceof Error ? iconError.message : String(iconError)}`);
        console.error(`[Domestic iOS Build ${buildId}] Error stack:`, iconError instanceof Error ? iconError.stack : "No stack trace");
        console.error(`[Domestic iOS Build ${buildId}] Icon path attempted: ${config.iconPath}`);
        console.log(`[Domestic iOS Build ${buildId}] ⚠️ Continuing build without custom icons...`);
        console.error(`[Domestic iOS Build ${buildId}] ========================================`);
      }
    } else {
      console.log(`[Domestic iOS Build ${buildId}] No icon path provided, skipping icon processing`);
    }

    await updateBuildStatus(db, buildId, "processing", 75);

    // Step 7: Repack zip
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", 85);

    // Step 8: Upload result
    const outputPath = `user-builds/builds/${buildId}/ios-source.zip`;
    await storage.uploadFile(outputPath, outputBuffer);

    await updateBuildStatus(db, buildId, "processing", 95);

    // Step 9: Get download URL and update record
    const downloadUrl = await storage.getTempDownloadUrl(outputPath);

    await db.collection("builds").doc(buildId).update({
      status: "completed",
      progress: 100,
      output_file_path: outputPath,
      download_url: downloadUrl,
      file_size: outputBuffer.length,
      updated_at: new Date().toISOString(),
    });

    console.log(`[Domestic iOS Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "ios",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic iOS Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic iOS Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "ios",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic iOS Build ${buildId}] Failed to track build failure event:`, err);
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
  const leanIOSDir = path.join(dir, "LeanIOS");
  if (fs.existsSync(leanIOSDir) && fs.statSync(leanIOSDir).isDirectory()) {
    const appConfigPath = path.join(leanIOSDir, "appConfig.json");
    if (fs.existsSync(appConfigPath)) return dir;
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

function findPbxprojFile(projectRoot: string): string | null {
  try {
    const items = fs.readdirSync(projectRoot);
    for (const item of items) {
      if (item.endsWith(".xcodeproj")) {
        const pbxprojPath = path.join(projectRoot, item, "project.pbxproj");
        if (fs.existsSync(pbxprojPath)) return pbxprojPath;
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function updateAppConfig(configPath: string, config: iOSBuildConfig): Promise<void> {
  const configContent = fs.readFileSync(configPath, "utf-8");
  const appConfig = JSON.parse(configContent);

  if (appConfig.general) {
    appConfig.general.initialUrl = config.url;
    appConfig.general.appName = config.appName;
    appConfig.general.iosBundleId = config.bundleId;
    appConfig.general.iosVersionString = config.versionString;
    appConfig.general.iosBuildNumber = parseInt(config.buildNumber, 10) || 1;
  }

  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
}

async function updatePbxproj(pbxprojPath: string, config: iOSBuildConfig): Promise<void> {
  let content = fs.readFileSync(pbxprojPath, "utf-8");

  content = content.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${config.versionString};`);
  content = content.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${config.buildNumber};`);
  content = content.replace(/BUILD_SETTINGS_APP_NAME = [^;]+;/g, `BUILD_SETTINGS_APP_NAME = ${config.appName};`);
  content = content.replace(/PRODUCT_BUNDLE_IDENTIFIER = co\.median\.ios\.[^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleId};`);

  fs.writeFileSync(pbxprojPath, content, "utf-8");
}

async function processIcons(projectRoot: string, iconBuffer: Buffer, buildId: string): Promise<void> {
  const imagesDir = path.join(projectRoot, "LeanIOS", "Images.xcassets");

  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Images.xcassets directory not found: ${imagesDir}`);
  }

  const normalizedBuffer = await sharp(iconBuffer)
    .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // Process AppIcon
  const appIconDir = path.join(imagesDir, "AppIcon.appiconset");
  if (fs.existsSync(appIconDir)) {
    for (const { name, size } of IOS_APP_ICON_SIZES) {
      const outputPath = path.join(appIconDir, name);
      try {
        await sharp(normalizedBuffer).resize(size, size).png().toFile(outputPath);
      } catch { /* ignore */ }
    }
  }

  // Process LaunchCenter
  const launchCenterDir = path.join(imagesDir, "LaunchCenter.imageset");
  if (fs.existsSync(launchCenterDir)) {
    for (const { name, size } of IOS_LAUNCH_CENTER_SIZES) {
      const outputPath = path.join(launchCenterDir, name);
      try {
        await sharp(normalizedBuffer).resize(size, size).png().toFile(outputPath);
      } catch { /* ignore */ }
    }
  }

  // Process HeaderImage
  const headerImageDir = path.join(imagesDir, "HeaderImage.imageset");
  if (fs.existsSync(headerImageDir)) {
    for (const { name, size } of IOS_HEADER_IMAGE_SIZES) {
      const outputPath = path.join(headerImageDir, name);
      try {
        await sharp(normalizedBuffer).resize(size, size).png().toFile(outputPath);
      } catch { /* ignore */ }
    }
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
