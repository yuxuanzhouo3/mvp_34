import { createServiceClient } from "@/lib/supabase/server";
import { trackBuildCompleteEvent } from "@/services/analytics";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface BuildConfig {
  url: string;
  appName: string;
  bundleName: string;
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  iconPath: string | null;
}

export async function processHarmonyOSBuild(
  buildId: string,
  config: BuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();

  try {
    // 获取构建记录以获取 user_id
    const { data: buildRecord } = await supabase
      .from("builds")
      .select("user_id")
      .eq("id", buildId)
      .single();

    userId = buildRecord?.user_id || null;

    // Update status to processing
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: Download harmonyos.zip from Storage
    console.log(`[Build ${buildId}] Downloading harmonyos.zip...`);
    const { data: zipData, error: downloadError } = await supabase.storage
      .from("HarmonyOS")
      .download("harmonyos.zip");

    if (downloadError || !zipData) {
      throw new Error(`Failed to download harmonyos.zip: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 15);

    // Step 2: Extract zip to temp directory
    console.log(`[Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `harmonyos-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipBuffer = Buffer.from(await zipData.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(supabase, buildId, "processing", 25);

    // Step 2.5: Find the actual project root
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find HarmonyOS project structure");
    }
    console.log(`[Build ${buildId}] Project root found: ${projectRoot}`);

    await updateBuildStatus(supabase, buildId, "processing", 30);

    // Step 3: Update appConfig.json (集中配置文件)
    console.log(`[Build ${buildId}] Updating appConfig.json...`);
    const appConfigPath = path.join(projectRoot, "entry", "src", "main", "resources", "rawfile", "appConfig.json");
    if (fs.existsSync(appConfigPath)) {
      await updateAppConfig(appConfigPath, config);
    } else {
      console.warn(`[Build ${buildId}] appConfig.json not found at ${appConfigPath}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 40);

    // Step 4: Update app.json5 (应用级配置)
    console.log(`[Build ${buildId}] Updating app.json5...`);
    const appJson5Path = path.join(projectRoot, "AppScope", "app.json5");
    if (fs.existsSync(appJson5Path)) {
      await updateAppJson5(appJson5Path, config);
    } else {
      console.warn(`[Build ${buildId}] app.json5 not found at ${appJson5Path}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 50);

    // Step 5: Update string.json files (应用名称)
    console.log(`[Build ${buildId}] Updating string.json files...`);

    // AppScope string.json
    const appScopeStringPath = path.join(projectRoot, "AppScope", "resources", "base", "element", "string.json");
    if (fs.existsSync(appScopeStringPath)) {
      await updateStringJson(appScopeStringPath, config.appName, "app_name");
    }

    // Entry string.json
    const entryStringPath = path.join(projectRoot, "entry", "src", "main", "resources", "base", "element", "string.json");
    if (fs.existsSync(entryStringPath)) {
      await updateStringJson(entryStringPath, config.appName, "EntryAbility_label");
    }

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 6: Update privacy policy
    console.log(`[Build ${buildId}] Updating privacy policy...`);
    const privacyPolicyPath = path.join(projectRoot, "entry", "src", "main", "resources", "rawfile", "privacy_policy.md");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPolicyPath, config.privacyPolicy, "utf-8");
    }

    await updateBuildStatus(supabase, buildId, "processing", 60);

    // Step 7: Process icons if provided
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

    await updateBuildStatus(supabase, buildId, "processing", 80);

    // Step 8: Repack zip
    console.log(`[Build ${buildId}] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 90);

    // Step 9: Upload result
    console.log(`[Build ${buildId}] Uploading result...`);
    const outputPath = `builds/${buildId}/harmonyos-source.zip`;
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

    // Step 10: Update build record with output path
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

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "harmonyos",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
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

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "harmonyos",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Build ${buildId}] Failed to track build failure event:`, err);
      });
    }
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
 * 递归查找 HarmonyOS 项目根目录
 * 查找包含 'entry' 和 'AppScope' 目录的项目结构
 */
function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  // 检查当前目录是否包含 HarmonyOS 项目结构
  const entryDir = path.join(dir, "entry");
  const appScopeDir = path.join(dir, "AppScope");

  if (fs.existsSync(entryDir) && fs.statSync(entryDir).isDirectory() &&
      fs.existsSync(appScopeDir) && fs.statSync(appScopeDir).isDirectory()) {
    // 进一步验证是否是 HarmonyOS 项目结构
    const mainDir = path.join(entryDir, "src", "main");
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

/**
 * 更新 appConfig.json 集中配置文件
 */
async function updateAppConfig(configPath: string, config: BuildConfig): Promise<void> {
  const configContent = fs.readFileSync(configPath, "utf-8");
  const appConfig = JSON.parse(configContent);

  if (appConfig.general) {
    appConfig.general.initialUrl = config.url;
    appConfig.general.appName = config.appName;
    appConfig.general.bundleName = config.bundleName;
    appConfig.general.versionName = config.versionName;
    appConfig.general.versionCode = parseInt(config.versionCode, 10) || 1;
  }

  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");
}

/**
 * 更新 app.json5 应用级配置
 */
async function updateAppJson5(appJson5Path: string, config: BuildConfig): Promise<void> {
  let content = fs.readFileSync(appJson5Path, "utf-8");

  // 使用正则替换 bundleName
  content = content.replace(
    /"bundleName"\s*:\s*"[^"]*"/,
    `"bundleName": "${config.bundleName}"`
  );

  // 替换 versionCode
  content = content.replace(
    /"versionCode"\s*:\s*\d+/,
    `"versionCode": ${parseInt(config.versionCode, 10) || 1}`
  );

  // 替换 versionName
  content = content.replace(
    /"versionName"\s*:\s*"[^"]*"/,
    `"versionName": "${config.versionName}"`
  );

  fs.writeFileSync(appJson5Path, content, "utf-8");
}

/**
 * 更新 string.json 文件中的指定字段
 */
async function updateStringJson(stringJsonPath: string, value: string, fieldName: string): Promise<void> {
  const content = fs.readFileSync(stringJsonPath, "utf-8");
  const stringJson = JSON.parse(content);

  if (stringJson.string && Array.isArray(stringJson.string)) {
    const field = stringJson.string.find((item: { name: string }) => item.name === fieldName);
    if (field) {
      field.value = value;
    }
  }

  fs.writeFileSync(stringJsonPath, JSON.stringify(stringJson, null, 2), "utf-8");
}

/**
 * 处理鸿蒙应用图标
 * 根据 harmonyos_switch.md 文档，需要处理 6 个图标文件
 */
async function processIcons(projectRoot: string, iconBuffer: Buffer, buildId: string): Promise<void> {
  console.log(`[Build ${buildId}] Processing HarmonyOS icons...`);

  // 预处理 - 将用户上传的图片标准化为 1024x1024 正方形
  const normalizedBuffer = await sharp(iconBuffer)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // 辅助函数：处理普通图标
  const processIcon = async (iconPath: string, size: number) => {
    const dir = path.dirname(iconPath);
    if (!fs.existsSync(dir)) {
      console.log(`[Build ${buildId}] Skipping ${iconPath} - directory not found`);
      return;
    }

    try {
      await sharp(normalizedBuffer)
        .resize(size, size)
        .png()
        .toFile(iconPath);
      console.log(`[Build ${buildId}] Created: ${iconPath} (${size}x${size})`);
    } catch (err) {
      console.error(`[Build ${buildId}] Failed to create ${iconPath}:`, err);
    }
  };

  // 辅助函数：处理前景图标（需要添加安全边距）
  const processForegroundIcon = async (iconPath: string, size: number) => {
    const dir = path.dirname(iconPath);
    if (!fs.existsSync(dir)) {
      console.log(`[Build ${buildId}] Skipping ${iconPath} - directory not found`);
      return;
    }

    try {
      // 计算安全区域大小（约 66% 的画布尺寸）
      const safeSize = Math.round(size * 0.66);
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
        .toFile(iconPath);
      console.log(`[Build ${buildId}] Created foreground: ${iconPath} (${size}x${size}, icon ${safeSize}x${safeSize})`);
    } catch (err) {
      console.error(`[Build ${buildId}] Failed to create ${iconPath}:`, err);
    }
  };

  // 1. 应用图标 (icon.png) - 256x256
  const entryIconPath = path.join(projectRoot, "entry", "src", "main", "resources", "base", "media", "icon.png");
  await processIcon(entryIconPath, 256);

  // 2. 启动图标 (startIcon.png) - 256x256
  const startIconPath = path.join(projectRoot, "entry", "src", "main", "resources", "base", "media", "startIcon.png");
  await processIcon(startIconPath, 256);

  // 3. Entry 前景图层 (foreground.png) - 1024x1024 with 66% safe area
  const entryForegroundPath = path.join(projectRoot, "entry", "src", "main", "resources", "base", "media", "foreground.png");
  await processForegroundIcon(entryForegroundPath, 1024);

  // 4. AppScope 前景图层 (foreground.png) - 1024x1024 with 66% safe area
  const appScopeForegroundPath = path.join(projectRoot, "AppScope", "resources", "base", "media", "foreground.png");
  await processForegroundIcon(appScopeForegroundPath, 1024);

  // 5. Entry 背景图层 (background.png) - 1024x1024 纯白色背景
  const entryBackgroundPath = path.join(projectRoot, "entry", "src", "main", "resources", "base", "media", "background.png");
  if (fs.existsSync(path.dirname(entryBackgroundPath))) {
    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toFile(entryBackgroundPath);
    console.log(`[Build ${buildId}] Created background: ${entryBackgroundPath}`);
  }

  // 6. AppScope 背景图层 (background.png) - 1024x1024 纯白色背景
  const appScopeBackgroundPath = path.join(projectRoot, "AppScope", "resources", "base", "media", "background.png");
  if (fs.existsSync(path.dirname(appScopeBackgroundPath))) {
    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toFile(appScopeBackgroundPath);
    console.log(`[Build ${buildId}] Created background: ${appScopeBackgroundPath}`);
  }

  console.log(`[Build ${buildId}] All HarmonyOS icons processed successfully`);
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
