import { createServiceClient } from "@/lib/supabase/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface BuildConfig {
  url: string;
  appName: string;
  packageName: string;
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

const SPLASH_ICON_SIZES = [
  { folder: "drawable-mdpi", size: 180 },
  { folder: "drawable-hdpi", size: 270 },
  { folder: "drawable-xhdpi", size: 360 },
  { folder: "drawable-xxhdpi", size: 540 },
  { folder: "drawable-xxxhdpi", size: 720 },
];

export async function processAndroidBuild(
  buildId: string,
  config: BuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    // Update status to processing
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: Download android.zip from Storage
    console.log(`[Build ${buildId}] Downloading android.zip...`);
    const { data: zipData, error: downloadError } = await supabase.storage
      .from("Android")
      .download("android.zip");

    if (downloadError || !zipData) {
      throw new Error(`Failed to download android.zip: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 15);

    // Step 2: Extract zip to temp directory
    console.log(`[Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `android-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipBuffer = Buffer.from(await zipData.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(supabase, buildId, "processing", 30);

    // Step 2.5: Find the actual project root (folder containing 'app' directory)
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find 'app' directory");
    }
    console.log(`[Build ${buildId}] Project root found: ${projectRoot}`);

    // Step 3: Update config file in the existing assets directory
    console.log(`[Build ${buildId}] Updating config...`);
    const assetsDir = path.join(projectRoot, "app", "src", "main", "assets");

    if (!fs.existsSync(assetsDir)) {
      throw new Error(`Assets directory not found: ${assetsDir}`);
    }

    const configPath = path.join(assetsDir, "appConfig.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    await updateAppConfig(configPath, config);

    await updateBuildStatus(supabase, buildId, "processing", 45);

    // Step 4: Update privacy policy
    console.log(`[Build ${buildId}] Updating privacy policy...`);
    const privacyPath = path.join(assetsDir, "privacy_policy.txt");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPath, config.privacyPolicy, "utf-8");
    } else if (fs.existsSync(privacyPath)) {
      // 如果没有提供隐私政策但文件存在，保持原样
      console.log(`[Build ${buildId}] No privacy policy provided, keeping existing file`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 5: Process icons if provided
    if (config.iconPath) {
      console.log(`[Build ${buildId}] Processing icons...`);
      const { data: iconData, error: iconError } = await supabase.storage
        .from("user-builds")
        .download(config.iconPath);

      if (!iconError && iconData) {
        const iconBuffer = Buffer.from(await iconData.arrayBuffer());
        await processIcons(projectRoot, iconBuffer);
      } else {
        console.warn(`[Build ${buildId}] Failed to download icon: ${iconError?.message}`);
      }
    }

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 6: Repack zip (pack from tempDir to preserve original structure)
    console.log(`[Build ${buildId}] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 85);

    // Step 7: Upload result
    console.log(`[Build ${buildId}] Uploading result...`);
    const outputPath = `builds/${buildId}/android-source.zip`;
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

    // Step 8: Update build record with output path
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

    // Update build status to failed
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
 * 递归查找包含 'app' 目录的项目根目录
 * zip 解压后可能有一个或多个层级的父目录
 */
function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  // 检查当前目录是否包含 'app' 子目录
  const appDir = path.join(dir, "app");
  if (fs.existsSync(appDir) && fs.statSync(appDir).isDirectory()) {
    // 进一步验证是否是 Android 项目结构
    const mainDir = path.join(appDir, "src", "main");
    if (fs.existsSync(mainDir)) {
      return dir;
    }
  }

  // 如果达到最大深度，停止搜索
  if (maxDepth <= 0) {
    return null;
  }

  // 递归搜索子目录
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

async function updateAppConfig(configPath: string, config: BuildConfig): Promise<void> {
  // 读取现有配置文件
  const configContent = fs.readFileSync(configPath, "utf-8");
  const appConfig = JSON.parse(configContent);

  // Update general settings
  if (appConfig.general) {
    appConfig.general.initialUrl = config.url;
    appConfig.general.appName = config.appName;
    appConfig.general.androidPackageName = config.packageName;
    appConfig.general.androidVersionCode = parseInt(config.versionCode.replace(/\./g, "")) || 1;
  }

  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
}

async function processIcons(tempDir: string, iconBuffer: Buffer): Promise<void> {
  const resDir = path.join(tempDir, "app", "src", "main", "res");

  // Process app icons
  for (const { folder, size } of APP_ICON_SIZES) {
    const iconDir = path.join(resDir, folder);
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }

    const outputPath = path.join(iconDir, "ic_launcher.png");
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }

  // Process splash icons
  for (const { folder, size } of SPLASH_ICON_SIZES) {
    const splashDir = path.join(resDir, folder);
    if (!fs.existsSync(splashDir)) {
      fs.mkdirSync(splashDir, { recursive: true });
    }

    const outputPath = path.join(splashDir, "splash.png");
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
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
