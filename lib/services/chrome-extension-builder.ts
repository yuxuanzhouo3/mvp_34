import { createServiceClient } from "@/lib/supabase/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BUILD_TIMEOUT, withTimeout } from "./build-timeout";

interface BuildConfig {
  url: string;
  appName: string;
  versionName: string;
  description: string;
  iconPath: string | null;
}

// Chrome Extension icon sizes
const CHROME_ICON_SIZES = [16, 48, 128];

export async function processChromeExtensionBuild(
  buildId: string,
  config: BuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    // 使用超时包装整个构建过程
    tempDir = await withTimeout(
      buildChromeExtension(supabase, buildId, config),
      BUILD_TIMEOUT.CHROME,
      `Chrome extension build timed out after ${BUILD_TIMEOUT.CHROME / 1000} seconds`
    );
  } catch (error) {
    console.error(`[Build ${buildId}] Build failed:`, error);

    // Update build record with failure
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
        console.log(`[Build ${buildId}] Cleaned up temp directory`);
      } catch (cleanupError) {
        console.error(`[Build ${buildId}] Failed to cleanup temp directory:`, cleanupError);
      }
    }
  }
}

async function buildChromeExtension(
  supabase: ReturnType<typeof createServiceClient>,
  buildId: string,
  config: BuildConfig
): Promise<string> {
  // Update status to processing
  await updateBuildStatus(supabase, buildId, "processing", 5);

  // Step 1: Download googleplugin.zip from Storage
  console.log(`[Build ${buildId}] Downloading googleplugin.zip...`);
  const { data: zipData, error: downloadError } = await supabase.storage
    .from("GooglePlugin")
    .download("googleplugin.zip");

  if (downloadError || !zipData) {
    throw new Error(`Failed to download googleplugin.zip: ${downloadError?.message || "No data"}`);
  }

  await updateBuildStatus(supabase, buildId, "processing", 15);

  // Step 2: Extract zip to temp directory
  console.log(`[Build ${buildId}] Extracting zip...`);
  const tempDir = path.join(os.tmpdir(), `chrome-build-${buildId}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const zipBuffer = Buffer.from(await zipData.arrayBuffer());
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(tempDir, true);

  await updateBuildStatus(supabase, buildId, "processing", 30);

  // Step 2.5: Find the actual project root (folder containing manifest.json)
  const projectRoot = findProjectRoot(tempDir);
  if (!projectRoot) {
    throw new Error("Invalid zip structure: cannot find manifest.json");
  }
  console.log(`[Build ${buildId}] Project root found: ${projectRoot}`);

  // Step 3: Update manifest.json (唯一配置文件)
  console.log(`[Build ${buildId}] Updating manifest.json...`);
  const manifestPath = path.join(projectRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  await updateManifest(manifestPath, config);
  await updateBuildStatus(supabase, buildId, "processing", 50);

  // Step 4: Process icons if provided
  if (config.iconPath) {
    console.log(`[Build ${buildId}] Processing icons...`);
    await processIcons(supabase, projectRoot, config.iconPath);
  }
  await updateBuildStatus(supabase, buildId, "processing", 70);

  // Step 5: Create new zip (包裹在 googleplugin 文件夹内)
  console.log(`[Build ${buildId}] Creating output zip...`);
  const outputZip = new AdmZip();
  addDirectoryToZip(outputZip, projectRoot, "googleplugin");

  const outputBuffer = outputZip.toBuffer();
  await updateBuildStatus(supabase, buildId, "processing", 85);

  // Step 6: Upload result
  console.log(`[Build ${buildId}] Uploading result...`);
  const outputPath = `builds/${buildId}/chrome-extension.zip`;
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

  // Step 7: Update build record with success
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

  console.log(`[Build ${buildId}] Build completed successfully!`);
  return tempDir;
}

function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  // Check if manifest.json exists in current directory
  if (fs.existsSync(path.join(dir, "manifest.json"))) {
    return dir;
  }

  // 如果达到最大深度，停止搜索
  if (maxDepth <= 0) {
    return null;
  }

  // Check subdirectories
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        const result = findProjectRoot(subDir, maxDepth - 1);
        if (result) return result;
      }
    }
  } catch {
    // 忽略读取错误
  }

  return null;
}

async function updateManifest(manifestPath: string, config: BuildConfig): Promise<void> {
  const manifestContent = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  // Update standard manifest fields
  manifest.name = config.appName;
  manifest.version = config.versionName;
  manifest.description = config.description;
  manifest.action.default_title = config.appName;

  // Update custom config fields
  manifest.__config = {
    targetUrl: config.url,
    popup: {
      width: 360,
      height: 520,
      loadingText: "加载中...",
      timeoutText: "加载超时，请刷新或打开完整网站。",
      openFullText: "打开完整网站",
    },
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

async function processIcons(
  supabase: ReturnType<typeof createServiceClient>,
  projectRoot: string,
  iconPath: string
): Promise<void> {
  // Download user's icon
  const { data: iconData, error: iconError } = await supabase.storage
    .from("user-builds")
    .download(iconPath);

  if (iconError || !iconData) {
    console.error("Failed to download icon:", iconError);
    return;
  }

  const iconBuffer = Buffer.from(await iconData.arrayBuffer());

  // Standardize to 1024x1024 first
  const standardizedIcon = await sharp(iconBuffer)
    .resize(1024, 1024, { fit: "cover" })
    .png()
    .toBuffer();

  const iconsDir = path.join(projectRoot, "icons");
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Generate icons for each size
  for (const size of CHROME_ICON_SIZES) {
    const resizedIcon = await sharp(standardizedIcon)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer();

    const iconFileName = `icon${size}.png`;
    fs.writeFileSync(path.join(iconsDir, iconFileName), resizedIcon);
    console.log(`Generated ${iconFileName}`);
  }

  // Also save the original as icon.png
  fs.writeFileSync(path.join(iconsDir, "icon.png"), standardizedIcon);
}

function addDirectoryToZip(zip: AdmZip, dirPath: string, zipPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, entryZipPath);
    } else {
      const fileContent = fs.readFileSync(fullPath);
      zip.addFile(entryZipPath, fileContent);
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
