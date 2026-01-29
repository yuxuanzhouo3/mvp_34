/**
 * 国内版 macOS 构建服务
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
import { PassThrough } from "stream";

interface MacOSBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

export async function processMacOSAppBuildDomestic(
  buildId: string,
  config: MacOSBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();
  const progressHelper = new BuildProgressHelper("macos");

  try {
    // 获取构建记录以获取 user_id
    const buildRecord = await db.collection("builds").doc(buildId).get();
    userId = buildRecord?.data?.[0]?.user_id || null;

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("initializing"));

    // Step 1: Download macOS App template (ZIP format)
    console.log(`[Domestic macOS Build ${buildId}] Downloading tauri-shell.app.zip...`);
    const templateBuffer = await storage.downloadFile("MacOSApp/tauri-shell.app.zip");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("downloading"));

    // Step 2: Create temp directory
    tempDir = path.join(os.tmpdir(), `macos-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: Extract template
    console.log(`[Domestic macOS Build ${buildId}] Extracting template...`);
    const zip = new AdmZip(templateBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("extracting"));

    // Step 4: Find .app directory
    const appDir = findAppDirectory(tempDir);
    if (!appDir) {
      throw new Error("Could not find .app directory in template");
    }

    // Step 5: Write config to Resources directory
    console.log(`[Domestic macOS Build ${buildId}] Writing config...`);
    const resourcesDir = path.join(appDir, "Contents", "Resources");
    fs.mkdirSync(resourcesDir, { recursive: true });

    const appConfig = {
      url: config.url,
      title: config.appName,
    };
    const configPath = path.join(resourcesDir, "app-config.json");
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("configuring"));

    // Step 6: Update Info.plist
    console.log(`[Domestic macOS Build ${buildId}] Updating Info.plist...`);
    await updateInfoPlist(appDir, config.appName);

    // Step 7: Replace icon if provided
    if (config.iconPath) {
      console.log(`[Domestic macOS Build ${buildId}] Replacing icon...`);
      await replaceAppIcon(storage, appDir, config.iconPath);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_icons"));

    // Step 8: Rename .app directory
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, "").trim() || "App";
    const newAppDir = path.join(tempDir, `${safeAppName}.app`);
    if (appDir !== newAppDir) {
      fs.renameSync(appDir, newAppDir);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    // Step 9: Create ZIP archive with archiver (preserves Unix permissions)
    console.log(`[Domestic macOS Build ${buildId}] Creating ZIP archive...`);
    const archiver = (await import("archiver")).default;

    const outputBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
      passThrough.on("end", () => resolve(Buffer.concat(chunks)));
      passThrough.on("error", reject);

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", reject);
      archive.pipe(passThrough);

      // Recursively add files with correct Unix permissions
      const addFolderToArchive = (folderPath: string, zipPath: string) => {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(folderPath, entry.name);
          const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            addFolderToArchive(fullPath, entryZipPath);
          } else {
            const fileData = fs.readFileSync(fullPath);
            // Check if it's an executable in MacOS directory
            const isMacOSExecutable = entryZipPath.includes("/Contents/MacOS/");
            const mode = isMacOSExecutable ? 0o755 : 0o644;

            archive.append(fileData, { name: entryZipPath, mode });
          }
        }
      };

      addFolderToArchive(newAppDir, `${safeAppName}.app`);
      archive.finalize();
    });

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("uploading"));

    // Step 10: Upload result
    console.log(`[Domestic macOS Build ${buildId}] Uploading result...`);
    const outputPath = `user-builds/builds/${buildId}/${safeAppName}.app.zip`;
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

    console.log(`[Domestic macOS Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "macos",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic macOS Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic macOS Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "macos",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic macOS Build ${buildId}] Failed to track build failure event:`, err);
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

function findAppDirectory(baseDir: string): string | null {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return path.join(baseDir, entry.name);
    }
  }

  // Recursively search one level
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
    console.warn("[Domestic macOS Build] Info.plist not found, skipping...");
    return;
  }

  let plistContent = fs.readFileSync(plistPath, "utf-8");

  // Replace CFBundleName
  plistContent = plistContent.replace(
    /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleName</key>\n\t<string>${escapeXml(appName)}</string>`
  );

  // Replace CFBundleDisplayName
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
  storage: ReturnType<typeof getCloudBaseStorage>,
  appDir: string,
  iconPath: string
): Promise<void> {
  try {
    const iconBuffer = await storage.downloadFile(iconPath);

    // Generate ICNS file
    const icnsBuffer = await generateIcns(iconBuffer);

    // Write to Resources directory
    const resourcesDir = path.join(appDir, "Contents", "Resources");
    const icnsPath = path.join(resourcesDir, "AppIcon.icns");

    // Find existing icns file and replace
    const existingIcns = findExistingIcns(resourcesDir);
    if (existingIcns) {
      fs.writeFileSync(existingIcns, icnsBuffer);
    } else {
      fs.writeFileSync(icnsPath, icnsBuffer);
    }

    console.log("[Domestic macOS Build] Icon replaced successfully");
  } catch (error) {
    console.warn("[Domestic macOS Build] Icon replacement failed:", error);
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
 * Generate macOS ICNS icon file
 */
async function generateIcns(pngBuffer: Buffer): Promise<Buffer> {
  const iconTypes: Array<{ size: number; type: string }> = [
    { size: 16, type: "icp4" },
    { size: 32, type: "icp5" },
    { size: 64, type: "icp6" },
    { size: 128, type: "ic07" },
    { size: 256, type: "ic08" },
    { size: 512, type: "ic09" },
    { size: 1024, type: "ic10" },
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
      // Skip sizes that can't be generated
    }
  }

  // Build ICNS file
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
    icnsBuffer.write(entry.type, offset);
    offset += 4;

    icnsBuffer.writeUInt32BE(8 + entry.data.length, offset);
    offset += 4;

    entry.data.copy(icnsBuffer, offset);
    offset += entry.data.length;
  }

  return icnsBuffer;
}
