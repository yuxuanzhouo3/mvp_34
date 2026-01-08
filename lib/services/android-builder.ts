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
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  iconPath: string | null;
}

// Icon sizes for Android - 应用图标 (ic_launcher.png)
const APP_ICON_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

// 自适应图标前景层 (ic_launcher_foreground.png) - Android 8.0+
const APP_ICON_FOREGROUND_SIZES = [
  { folder: "mipmap-mdpi", size: 108 },
  { folder: "mipmap-hdpi", size: 162 },
  { folder: "mipmap-xhdpi", size: 216 },
  { folder: "mipmap-xxhdpi", size: 324 },
  { folder: "mipmap-xxxhdpi", size: 432 },
];

// 启动页图标 (splash.png)
const SPLASH_ICON_SIZES = [
  { folder: "drawable-mdpi", size: 180 },
  { folder: "drawable-hdpi", size: 270 },
  { folder: "drawable-xhdpi", size: 360 },
  { folder: "drawable-xxhdpi", size: 540 },
  { folder: "drawable-xxxhdpi", size: 720 },
];

// 夜间模式启动页图标 (splash.png)
const SPLASH_NIGHT_ICON_SIZES = [
  { folder: "drawable-night-mdpi", size: 180 },
  { folder: "drawable-night-hdpi", size: 270 },
  { folder: "drawable-night-xhdpi", size: 360 },
  { folder: "drawable-night-xxhdpi", size: 540 },
  { folder: "drawable-night-xxxhdpi", size: 720 },
];

// 侧边栏Logo (ic_sidebar_logo.png)
const SIDEBAR_LOGO_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

// 夜间模式侧边栏Logo (ic_sidebar_logo.png)
const SIDEBAR_LOGO_NIGHT_SIZES = [
  { folder: "mipmap-night-mdpi", size: 48 },
  { folder: "mipmap-night-hdpi", size: 72 },
  { folder: "mipmap-night-xhdpi", size: 96 },
  { folder: "mipmap-night-xxhdpi", size: 144 },
  { folder: "mipmap-night-xxxhdpi", size: 192 },
];

// 操作栏图标 (ic_actionbar.png) - 24dp 基准
const ACTIONBAR_ICON_SIZES = [
  { folder: "drawable-mdpi", size: 24 },
  { folder: "drawable-hdpi", size: 36 },
  { folder: "drawable-xhdpi", size: 48 },
  { folder: "drawable-xxhdpi", size: 72 },
  { folder: "drawable-xxxhdpi", size: 96 },
];

// 夜间模式操作栏图标 (ic_actionbar.png) - 24dp 基准
const ACTIONBAR_NIGHT_ICON_SIZES = [
  { folder: "drawable-night-mdpi", size: 24 },
  { folder: "drawable-night-hdpi", size: 36 },
  { folder: "drawable-night-xhdpi", size: 48 },
  { folder: "drawable-night-xxhdpi", size: 72 },
  { folder: "drawable-night-xxxhdpi", size: 96 },
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

    // Step 3.5: Update AndroidManifest.xml version
    console.log(`[Build ${buildId}] Updating AndroidManifest.xml...`);
    const manifestPath = path.join(projectRoot, "app", "src", "main", "AndroidManifest.xml");
    if (fs.existsSync(manifestPath)) {
      await updateAndroidManifest(manifestPath, config);
    } else {
      console.warn(`[Build ${buildId}] AndroidManifest.xml not found, skipping version update`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 45);

    // Step 4: Update privacy policy (Markdown 格式)
    console.log(`[Build ${buildId}] Updating privacy policy...`);
    const privacyPathMd = path.join(assetsDir, "privacy_policy.md");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPathMd, config.privacyPolicy, "utf-8");
    } else if (fs.existsSync(privacyPathMd)) {
      console.log(`[Build ${buildId}] No privacy policy provided, keeping existing file`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 5: Process icons if provided
    if (config.iconPath) {
      console.log(`[Build ${buildId}] Processing icons, iconPath: ${config.iconPath}`);
      try {
        const { data: iconData, error: iconError } = await supabase.storage
          .from("user-builds")
          .download(config.iconPath);

        if (iconError) {
          console.error(`[Build ${buildId}] Failed to download icon: ${iconError.message}`);
          // 图标下载失败不中断构建，继续执行
        } else if (iconData) {
          console.log(`[Build ${buildId}] Icon downloaded successfully, size: ${iconData.size} bytes`);
          const iconBuffer = Buffer.from(await iconData.arrayBuffer());
          await processIcons(projectRoot, iconBuffer, buildId);
          console.log(`[Build ${buildId}] Icon processing completed`);
        }
      } catch (iconProcessError) {
        // 图标处理失败不中断构建，记录错误并继续
        console.error(`[Build ${buildId}] Icon processing failed:`, iconProcessError);
        console.log(`[Build ${buildId}] Continuing build without custom icons...`);
      }
    } else {
      console.log(`[Build ${buildId}] No icon provided, skipping icon processing`);
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

    // Step 8: Update build record with output path and file size
    const { error: updateError } = await supabase
      .from("builds")
      .update({
        status: "completed",
        progress: 100,
        output_file_path: outputPath,
        file_size: outputBuffer.length,
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
    appConfig.general.androidVersionName = config.versionName;
    appConfig.general.androidVersionCode = parseInt(config.versionCode, 10) || 1;
  }

  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
}

async function updateAndroidManifest(manifestPath: string, config: BuildConfig): Promise<void> {
  // 读取 AndroidManifest.xml
  let manifestContent = fs.readFileSync(manifestPath, "utf-8");

  // 使用正则替换 android:versionName 属性
  manifestContent = manifestContent.replace(
    /android:versionName="[^"]*"/,
    `android:versionName="${config.versionName}"`
  );

  fs.writeFileSync(manifestPath, manifestContent, "utf-8");
}

async function processIcons(projectRoot: string, iconBuffer: Buffer, buildId: string): Promise<void> {
  const resDir = path.join(projectRoot, "app", "src", "main", "res");

  console.log(`[Build ${buildId}] Processing icons, res directory: ${resDir}`);

  if (!fs.existsSync(resDir)) {
    console.error(`[Build ${buildId}] Res directory not found: ${resDir}`);
    throw new Error(`Res directory not found: ${resDir}`);
  }

  // Step 1: 预处理 - 将用户上传的图片标准化为 1024x1024 正方形
  // 使用 contain 模式保持宽高比，居中显示，透明背景填充
  console.log(`[Build ${buildId}] Normalizing icon to 1024x1024...`);
  const normalizedBuffer = await sharp(iconBuffer)
    .resize(1024, 1024, {
      fit: "contain",           // 保持宽高比，完整显示图片
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
    })
    .png()
    .toBuffer();

  console.log(`[Build ${buildId}] Icon normalized successfully`);

  // 辅助函数：处理普通图标（从标准化后的图片缩放）
  const processIcon = async (folder: string, size: number, fileName: string) => {
    const iconDir = path.join(resDir, folder);
    const outputPath = path.join(iconDir, fileName);

    // 只有目录存在时才处理（不创建新目录）
    if (!fs.existsSync(iconDir)) {
      console.log(`[Build ${buildId}] Skipping ${folder}/${fileName} - directory not found`);
      return;
    }

    try {
      await sharp(normalizedBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`[Build ${buildId}] Created: ${folder}/${fileName} (${size}x${size})`);
    } catch (err) {
      console.error(`[Build ${buildId}] Failed to create ${outputPath}:`, err);
      throw err;
    }
  };

  // 辅助函数：处理自适应图标前景层（需要添加安全边距）
  // Android 自适应图标规范：画布 108dp，可见区域 72dp（66.7%），安全区域 66dp（61%）
  // 系统会裁剪外围区域，所以图标需要缩小并居中
  const processForegroundIcon = async (folder: string, size: number, fileName: string) => {
    const iconDir = path.join(resDir, folder);
    const outputPath = path.join(iconDir, fileName);

    if (!fs.existsSync(iconDir)) {
      console.log(`[Build ${buildId}] Skipping ${folder}/${fileName} - directory not found`);
      return;
    }

    try {
      // 计算安全区域大小（约 61% 的画布尺寸）
      const safeSize = Math.round(size * 0.61);
      // 计算需要添加的边距
      const padding = Math.round((size - safeSize) / 2);

      // 先把图标缩放到安全区域大小，然后用 extend 添加透明边距
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

      console.log(`[Build ${buildId}] Created foreground: ${folder}/${fileName} (${size}x${size}, icon ${safeSize}x${safeSize})`);
    } catch (err) {
      console.error(`[Build ${buildId}] Failed to create ${outputPath}:`, err);
      throw err;
    }
  };

  // 1. 应用图标 (ic_launcher.png)
  console.log(`[Build ${buildId}] Processing app icons (ic_launcher.png)...`);
  for (const { folder, size } of APP_ICON_SIZES) {
    await processIcon(folder, size, "ic_launcher.png");
  }

  // 2. 自适应图标前景层 (ic_launcher_foreground.png) - 需要添加安全边距
  console.log(`[Build ${buildId}] Processing app icon foreground (ic_launcher_foreground.png)...`);
  for (const { folder, size } of APP_ICON_FOREGROUND_SIZES) {
    await processForegroundIcon(folder, size, "ic_launcher_foreground.png");
  }

  // 3. 启动页图标 (splash.png) - Android 12+ 也会裁剪，需要添加安全边距
  console.log(`[Build ${buildId}] Processing splash icons (splash.png)...`);
  for (const { folder, size } of SPLASH_ICON_SIZES) {
    await processForegroundIcon(folder, size, "splash.png");
  }

  // 4. 夜间模式启动页图标 (splash.png)
  console.log(`[Build ${buildId}] Processing night mode splash icons...`);
  for (const { folder, size } of SPLASH_NIGHT_ICON_SIZES) {
    await processForegroundIcon(folder, size, "splash.png");
  }

  // 5. 侧边栏Logo (ic_sidebar_logo.png)
  console.log(`[Build ${buildId}] Processing sidebar logo (ic_sidebar_logo.png)...`);
  for (const { folder, size } of SIDEBAR_LOGO_SIZES) {
    await processIcon(folder, size, "ic_sidebar_logo.png");
  }

  // 6. 夜间模式侧边栏Logo (ic_sidebar_logo.png)
  console.log(`[Build ${buildId}] Processing night mode sidebar logo...`);
  for (const { folder, size } of SIDEBAR_LOGO_NIGHT_SIZES) {
    await processIcon(folder, size, "ic_sidebar_logo.png");
  }

  // 7. 操作栏图标 (ic_actionbar.png)
  console.log(`[Build ${buildId}] Processing actionbar icons (ic_actionbar.png)...`);
  for (const { folder, size } of ACTIONBAR_ICON_SIZES) {
    await processIcon(folder, size, "ic_actionbar.png");
  }

  // 8. 夜间模式操作栏图标 (ic_actionbar.png)
  console.log(`[Build ${buildId}] Processing night mode actionbar icons...`);
  for (const { folder, size } of ACTIONBAR_NIGHT_ICON_SIZES) {
    await processIcon(folder, size, "ic_actionbar.png");
  }

  console.log(`[Build ${buildId}] All icons processed successfully`);
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
