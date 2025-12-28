import { createServiceClient } from "@/lib/supabase/server";
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

// iOS 应用图标尺寸
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

// 启动页中心图标
const IOS_LAUNCH_CENTER_SIZES = [
  { name: "2x.png", size: 200 },
  { name: "2xDark.png", size: 200 },
];

// 侧边栏头图
const IOS_HEADER_IMAGE_SIZES = [
  { name: "header.png", size: 60 },
  { name: "header@2x.png", size: 120 },
  { name: "header@3x.png", size: 180 },
  { name: "headerDark.png", size: 60 },
  { name: "headerDark@2x.png", size: 120 },
  { name: "headerDark@3x.png", size: 180 },
];

export async function processiOSBuild(
  buildId: string,
  config: iOSBuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    // Update status to processing
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: Download ios.zip from Storage
    console.log(`[Build ${buildId}] Downloading ios.zip...`);
    const { data: zipData, error: downloadError } = await supabase.storage
      .from("iOS")
      .download("ios.zip");

    if (downloadError || !zipData) {
      throw new Error(`Failed to download ios.zip: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 15);

    // Step 2: Extract zip to temp directory
    console.log(`[Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `ios-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipBuffer = Buffer.from(await zipData.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(supabase, buildId, "processing", 25);

    // Step 2.5: Find the actual project root (folder containing 'LeanIOS' directory)
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find 'LeanIOS' directory");
    }
    console.log(`[Build ${buildId}] Project root found: ${projectRoot}`);

    // Step 3: Update appConfig.json
    console.log(`[Build ${buildId}] Updating appConfig.json...`);
    const configPath = path.join(projectRoot, "LeanIOS", "appConfig.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    await updateAppConfig(configPath, config);

    await updateBuildStatus(supabase, buildId, "processing", 35);

    // Step 4: Update project.pbxproj
    console.log(`[Build ${buildId}] Updating project.pbxproj...`);
    const pbxprojPath = findPbxprojFile(projectRoot);
    if (pbxprojPath) {
      await updatePbxproj(pbxprojPath, config);
    } else {
      console.warn(`[Build ${buildId}] project.pbxproj not found, skipping...`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 45);

    // Step 5: Update privacy policy
    console.log(`[Build ${buildId}] Updating privacy policy...`);
    const leanIOSDir = path.join(projectRoot, "LeanIOS");
    const privacyPathMd = path.join(leanIOSDir, "privacy_policy.md");
    const privacyPathTxt = path.join(leanIOSDir, "privacy_policy.txt");

    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPathMd, config.privacyPolicy, "utf-8");
      if (fs.existsSync(privacyPathTxt)) {
        fs.unlinkSync(privacyPathTxt);
      }
    } else if (fs.existsSync(privacyPathMd) || fs.existsSync(privacyPathTxt)) {
      console.log(`[Build ${buildId}] No privacy policy provided, keeping existing file`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 6: Process icons if provided
    if (config.iconPath) {
      console.log(`[Build ${buildId}] Processing icons, iconPath: ${config.iconPath}`);
      try {
        const { data: iconData, error: iconError } = await supabase.storage
          .from("user-builds")
          .download(config.iconPath);

        if (iconError) {
          console.error(`[Build ${buildId}] Failed to download icon: ${iconError.message}`);
        } else if (iconData) {
          console.log(`[Build ${buildId}] Icon downloaded successfully, size: ${iconData.size} bytes`);
          const iconBuffer = Buffer.from(await iconData.arrayBuffer());
          await processIcons(projectRoot, iconBuffer, buildId);
          console.log(`[Build ${buildId}] Icon processing completed`);
        }
      } catch (iconProcessError) {
        console.error(`[Build ${buildId}] Icon processing failed:`, iconProcessError);
        console.log(`[Build ${buildId}] Continuing build without custom icons...`);
      }
    } else {
      console.log(`[Build ${buildId}] No icon provided, skipping icon processing`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 7: Repack zip
    console.log(`[Build ${buildId}] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 85);

    // Step 8: Upload result
    console.log(`[Build ${buildId}] Uploading result...`);
    const outputPath = `builds/${buildId}/ios-source.zip`;
    const { error: uploadError } = await supabase.storage
      .from("user-builds")
      .upload(outputPath, outputBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload result: ${uploadError.message}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 95);

    // Step 9: Update build record with output path
    const { error: updateError } = await supabase
      .from("builds")
      .update({
        status: "completed",
        progress: 100,
        output_file_path: outputPath,
      })
      .eq("id", buildId);

    if (updateError) {
      throw new Error(`Failed to update build record: ${updateError.message}`);
    }

    console.log(`[Build ${buildId}] Completed successfully!`);
  } catch (error) {
    console.error(`[Build ${buildId}] Error:`, error);

    await supabase
      .from("builds")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", buildId);
  } finally {
    // Cleanup temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`[Build ${buildId}] Failed to cleanup temp dir:`, cleanupError);
      }
    }
  }
}

async function updateBuildStatus(
  supabase: ReturnType<typeof createServiceClient>,
  buildId: string,
  status: string,
  progress: number
): Promise<void> {
  await supabase
    .from("builds")
    .update({ status, progress })
    .eq("id", buildId);
}

/**
 * 递归查找包含 'LeanIOS' 目录的项目根目录
 */
function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  const leanIOSDir = path.join(dir, "LeanIOS");
  if (fs.existsSync(leanIOSDir) && fs.statSync(leanIOSDir).isDirectory()) {
    const appConfigPath = path.join(leanIOSDir, "appConfig.json");
    if (fs.existsSync(appConfigPath)) {
      return dir;
    }
  }

  if (maxDepth <= 0) {
    return null;
  }

  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const result = findProjectRoot(itemPath, maxDepth - 1);
        if (result) {
          return result;
        }
      }
    }
  } catch {
    // 忽略读取错误
  }

  return null;
}

/**
 * 查找 project.pbxproj 文件
 */
function findPbxprojFile(projectRoot: string): string | null {
  try {
    const items = fs.readdirSync(projectRoot);
    for (const item of items) {
      if (item.endsWith(".xcodeproj")) {
        const pbxprojPath = path.join(projectRoot, item, "project.pbxproj");
        if (fs.existsSync(pbxprojPath)) {
          return pbxprojPath;
        }
      }
    }
  } catch {
    // 忽略读取错误
  }
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

  // 更新 MARKETING_VERSION
  content = content.replace(
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${config.versionString};`
  );

  // 更新 CURRENT_PROJECT_VERSION
  content = content.replace(
    /CURRENT_PROJECT_VERSION = [^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${config.buildNumber};`
  );

  // 更新 BUILD_SETTINGS_APP_NAME
  content = content.replace(
    /BUILD_SETTINGS_APP_NAME = [^;]+;/g,
    `BUILD_SETTINGS_APP_NAME = ${config.appName};`
  );

  // 更新 PRODUCT_BUNDLE_IDENTIFIER (只更新主应用的，不更新测试目标的)
  // 匹配 PRODUCT_BUNDLE_IDENTIFIER = co.median.ios.xxx; 格式
  content = content.replace(
    /PRODUCT_BUNDLE_IDENTIFIER = co\.median\.ios\.[^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleId};`
  );

  fs.writeFileSync(pbxprojPath, content, "utf-8");
}

async function processIcons(projectRoot: string, iconBuffer: Buffer, buildId: string): Promise<void> {
  const imagesDir = path.join(projectRoot, "LeanIOS", "Images.xcassets");

  console.log(`[Build ${buildId}] Processing iOS icons, images directory: ${imagesDir}`);

  if (!fs.existsSync(imagesDir)) {
    console.error(`[Build ${buildId}] Images.xcassets directory not found: ${imagesDir}`);
    throw new Error(`Images.xcassets directory not found: ${imagesDir}`);
  }

  // 预处理 - 将用户上传的图片标准化为 1024x1024 正方形
  console.log(`[Build ${buildId}] Normalizing icon to 1024x1024...`);
  const normalizedBuffer = await sharp(iconBuffer)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  console.log(`[Build ${buildId}] Icon normalized successfully`);

  // 处理应用图标
  const appIconDir = path.join(imagesDir, "AppIcon.appiconset");
  if (fs.existsSync(appIconDir)) {
    console.log(`[Build ${buildId}] Processing AppIcon...`);
    for (const { name, size } of IOS_APP_ICON_SIZES) {
      const outputPath = path.join(appIconDir, name);
      try {
        await sharp(normalizedBuffer)
          .resize(size, size)
          .png()
          .toFile(outputPath);
        console.log(`[Build ${buildId}] Created: AppIcon/${name} (${size}x${size})`);
      } catch (err) {
        console.error(`[Build ${buildId}] Failed to create ${outputPath}:`, err);
      }
    }
  }

  // 处理启动页中心图标
  const launchCenterDir = path.join(imagesDir, "LaunchCenter.imageset");
  if (fs.existsSync(launchCenterDir)) {
    console.log(`[Build ${buildId}] Processing LaunchCenter...`);
    for (const { name, size } of IOS_LAUNCH_CENTER_SIZES) {
      const outputPath = path.join(launchCenterDir, name);
      try {
        await sharp(normalizedBuffer)
          .resize(size, size)
          .png()
          .toFile(outputPath);
        console.log(`[Build ${buildId}] Created: LaunchCenter/${name} (${size}x${size})`);
      } catch (err) {
        console.error(`[Build ${buildId}] Failed to create ${outputPath}:`, err);
      }
    }
  }

  // 处理侧边栏头图
  const headerImageDir = path.join(imagesDir, "HeaderImage.imageset");
  if (fs.existsSync(headerImageDir)) {
    console.log(`[Build ${buildId}] Processing HeaderImage...`);
    for (const { name, size } of IOS_HEADER_IMAGE_SIZES) {
      const outputPath = path.join(headerImageDir, name);
      try {
        await sharp(normalizedBuffer)
          .resize(size, size)
          .png()
          .toFile(outputPath);
        console.log(`[Build ${buildId}] Created: HeaderImage/${name} (${size}x${size})`);
      } catch (err) {
        console.error(`[Build ${buildId}] Failed to create ${outputPath}:`, err);
      }
    }
  }

  console.log(`[Build ${buildId}] All iOS icons processed successfully`);
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
