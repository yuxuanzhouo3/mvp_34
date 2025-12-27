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

    // Step 3: Ensure assets directory exists and update config file
    console.log(`[Build ${buildId}] Updating config...`);
    const assetsDir = path.join(tempDir, "app", "src", "main", "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const configPath = path.join(assetsDir, "appConfig.json");
    await updateAppConfig(configPath, config);

    await updateBuildStatus(supabase, buildId, "processing", 45);

    // Step 4: Update privacy policy
    console.log(`[Build ${buildId}] Updating privacy policy...`);
    const privacyPath = path.join(assetsDir, "privacy_policy.txt");
    if (config.privacyPolicy) {
      fs.writeFileSync(privacyPath, config.privacyPolicy, "utf-8");
    } else {
      // 写入默认的隐私政策占位符
      fs.writeFileSync(privacyPath, "Privacy Policy\n\nNo privacy policy provided.", "utf-8");
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
        await processIcons(tempDir, iconBuffer);
      } else {
        console.warn(`[Build ${buildId}] Failed to download icon: ${iconError?.message}`);
      }
    }

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 6: Repack zip
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

async function updateAppConfig(configPath: string, config: BuildConfig): Promise<void> {
  let appConfig: Record<string, unknown>;

  if (fs.existsSync(configPath)) {
    // 读取现有配置文件
    const configContent = fs.readFileSync(configPath, "utf-8");
    appConfig = JSON.parse(configContent);
  } else {
    // 创建默认配置结构
    console.log(`Config file not found, creating new one: ${configPath}`);
    appConfig = {
      general: {
        initialUrl: "",
        appName: "",
        androidPackageName: "",
        androidVersionCode: 1,
      },
    };
  }

  // Update general settings
  if (!appConfig.general) {
    appConfig.general = {};
  }

  const general = appConfig.general as Record<string, unknown>;
  general.initialUrl = config.url;
  general.appName = config.appName;
  general.androidPackageName = config.packageName;
  general.androidVersionCode = parseInt(config.versionCode.replace(/\./g, "")) || 1;

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
