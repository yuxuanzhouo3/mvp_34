import { createServiceClient } from "@/lib/supabase/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface MacOSBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

/**
 * macOS App 构建服务
 *
 * 由于 macOS 应用必须在 macOS 环境编译，此服务采用以下策略：
 * 1. 从 Supabase Storage 下载预构建的 .app 模板（ZIP 格式）
 * 2. 解压并修改配置文件（app-config.json）
 * 3. 替换图标（如果提供）
 * 4. 重新打包并上传
 *
 * 预构建模板需要通过 GitHub Actions 在 macOS runner 上编译
 */
export async function processMacOSAppBuild(
  buildId: string,
  config: MacOSBuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: 下载预构建的 macOS App 模板 (ZIP 格式)
    console.log("[macOS Build] Downloading template...");
    const { data: templateData, error: downloadError } = await supabase.storage
      .from("MacOSApp")
      .download("tauri-shell.app.zip");

    if (downloadError || !templateData) {
      throw new Error(`Failed to download macOS template: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 25);

    // Step 2: 创建临时目录
    tempDir = path.join(os.tmpdir(), `macos-build-${buildId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: 解压模板
    console.log("[macOS Build] Extracting template...");
    const AdmZip = (await import("adm-zip")).default;
    const templateBuffer = Buffer.from(await templateData.arrayBuffer());
    const zip = new AdmZip(templateBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(supabase, buildId, "processing", 40);

    // Step 4: 查找 .app 目录
    const appDir = findAppDirectory(tempDir);
    if (!appDir) {
      throw new Error("Could not find .app directory in template");
    }

    // Step 5: 写入配置文件到 Resources 目录
    console.log("[macOS Build] Writing config...");
    const resourcesDir = path.join(appDir, "Contents", "Resources");
    fs.mkdirSync(resourcesDir, { recursive: true });

    const appConfig = {
      url: config.url,
      title: config.appName,
    };
    const configPath = path.join(resourcesDir, "app-config.json");
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 6: 修改 Info.plist（应用名称）
    console.log("[macOS Build] Updating Info.plist...");
    await updateInfoPlist(appDir, config.appName);

    await updateBuildStatus(supabase, buildId, "processing", 65);

    // Step 7: 替换图标（如果提供）
    if (config.iconPath) {
      console.log("[macOS Build] Replacing icon...");
      await replaceAppIcon(supabase, appDir, config.iconPath);
    }

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 8: 重命名 .app 目录
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, "").trim() || "App";
    const newAppDir = path.join(tempDir, `${safeAppName}.app`);
    if (appDir !== newAppDir) {
      fs.renameSync(appDir, newAppDir);
    }

    // Step 9: 打包为 ZIP
    console.log("[macOS Build] Creating ZIP archive...");
    const outputZip = new AdmZip();
    outputZip.addLocalFolder(newAppDir, `${safeAppName}.app`);
    const outputBuffer = outputZip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 85);

    // Step 10: 上传结果
    console.log("[macOS Build] Uploading result...");
    const outputPath = `builds/${buildId}/${safeAppName}.app.zip`;
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

    // Step 11: 更新构建记录
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

    console.log("[macOS Build] Build completed successfully!");
  } catch (error) {
    console.error("[macOS Build] Error:", error);

    await supabase
      .from("builds")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", buildId);
  } finally {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn("[macOS Build] Cleanup error:", cleanupError);
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

function findAppDirectory(baseDir: string): string | null {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return path.join(baseDir, entry.name);
    }
  }

  // 递归查找一层
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(baseDir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isDirectory() && subEntry.name.endsWith(".app")) {
          return path.join(subDir, subEntry.name);
        }
      }
    }
  }

  return null;
}

async function updateInfoPlist(appDir: string, appName: string): Promise<void> {
  const plistPath = path.join(appDir, "Contents", "Info.plist");

  if (!fs.existsSync(plistPath)) {
    console.warn("[macOS Build] Info.plist not found, skipping...");
    return;
  }

  let plistContent = fs.readFileSync(plistPath, "utf-8");

  // 替换 CFBundleName
  plistContent = plistContent.replace(
    /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleName</key>\n\t<string>${escapeXml(appName)}</string>`
  );

  // 替换 CFBundleDisplayName
  if (plistContent.includes("<key>CFBundleDisplayName</key>")) {
    plistContent = plistContent.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
      `<key>CFBundleDisplayName</key>\n\t<string>${escapeXml(appName)}</string>`
    );
  }

  fs.writeFileSync(plistPath, plistContent, "utf-8");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function replaceAppIcon(
  supabase: ReturnType<typeof createServiceClient>,
  appDir: string,
  iconPath: string
): Promise<void> {
  try {
    // 下载用户图标
    const { data: iconData, error: iconError } = await supabase.storage
      .from("user-builds")
      .download(iconPath);

    if (iconError || !iconData) {
      console.warn("[macOS Build] Failed to download icon:", iconError);
      return;
    }

    const iconBuffer = Buffer.from(await iconData.arrayBuffer());

    // 生成 ICNS 文件
    const icnsBuffer = await generateIcns(iconBuffer);

    // 写入到 Resources 目录
    const resourcesDir = path.join(appDir, "Contents", "Resources");
    const icnsPath = path.join(resourcesDir, "AppIcon.icns");

    // 查找现有的 icns 文件并替换
    const existingIcns = findExistingIcns(resourcesDir);
    if (existingIcns) {
      fs.writeFileSync(existingIcns, icnsBuffer);
    } else {
      fs.writeFileSync(icnsPath, icnsBuffer);
    }

    console.log("[macOS Build] Icon replaced successfully");
  } catch (error) {
    console.warn("[macOS Build] Icon replacement failed:", error);
  }
}

function findExistingIcns(resourcesDir: string): string | null {
  if (!fs.existsSync(resourcesDir)) return null;

  const entries = fs.readdirSync(resourcesDir);
  for (const entry of entries) {
    if (entry.endsWith(".icns")) {
      return path.join(resourcesDir, entry);
    }
  }
  return null;
}

/**
 * 生成 macOS ICNS 图标文件
 * ICNS 格式包含多种尺寸的图标
 */
async function generateIcns(pngBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  // ICNS 图标尺寸和类型
  const iconTypes: Array<{ size: number; type: string }> = [
    { size: 16, type: "icp4" },   // 16x16
    { size: 32, type: "icp5" },   // 32x32
    { size: 64, type: "icp6" },   // 64x64
    { size: 128, type: "ic07" },  // 128x128
    { size: 256, type: "ic08" },  // 256x256
    { size: 512, type: "ic09" },  // 512x512
    { size: 1024, type: "ic10" }, // 1024x1024
  ];

  const iconEntries: Array<{ type: string; data: Buffer }> = [];

  for (const { size, type } of iconTypes) {
    try {
      const resized = await sharp(pngBuffer)
        .resize(size, size, { fit: "cover" })
        .png()
        .toBuffer();

      iconEntries.push({ type, data: resized });
    } catch {
      // 跳过无法生成的尺寸
    }
  }

  // 构建 ICNS 文件
  // ICNS 文件格式：
  // - 4 bytes: 'icns' magic
  // - 4 bytes: file size (big endian)
  // - entries: each entry has 4 byte type + 4 byte size + data

  let totalSize = 8; // header
  for (const entry of iconEntries) {
    totalSize += 8 + entry.data.length;
  }

  const icnsBuffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Magic number
  icnsBuffer.write("icns", offset);
  offset += 4;

  // File size (big endian)
  icnsBuffer.writeUInt32BE(totalSize, offset);
  offset += 4;

  // Write entries
  for (const entry of iconEntries) {
    // Type (4 bytes)
    icnsBuffer.write(entry.type, offset);
    offset += 4;

    // Size (4 bytes, big endian) - includes type and size fields
    icnsBuffer.writeUInt32BE(8 + entry.data.length, offset);
    offset += 4;

    // Data
    entry.data.copy(icnsBuffer, offset);
    offset += entry.data.length;
  }

  return icnsBuffer;
}
