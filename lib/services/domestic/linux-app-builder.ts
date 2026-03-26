/**
 * 国内版 Linux 构建服务
 * 使用 CloudBase 云存储和数据库
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { BuildProgressHelper } from "@/lib/build-progress";
import { trackBuildCompleteEvent } from "@/services/analytics";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PassThrough } from "stream";

interface LinuxBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

export async function processLinuxAppBuildDomestic(
  buildId: string,
  config: LinuxBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();
  const progressHelper = new BuildProgressHelper("linux");

  try {
    // 获取构建记录以获取 user_id
    const buildRecord = await db.collection("builds").doc(buildId).get();
    userId = buildRecord?.data?.[0]?.user_id || null;

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("initializing"));

    // Step 1: Download tar.gz template
    console.log(`[Domestic Linux Build ${buildId}] Downloading tauri-shell.tar.gz...`);
    const templateBuffer = await storage.downloadFile("LinuxApp/tauri-shell.tar.gz");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("downloading"));

    // Step 2: Create temp directory
    tempDir = path.join(os.tmpdir(), `linux-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: Extract tar.gz using tar library
    console.log(`[Domestic Linux Build ${buildId}] Extracting template...`);
    const tarPath = path.join(tempDir, "template.tar.gz");
    fs.writeFileSync(tarPath, templateBuffer);

    const tar = await import("tar");
    await tar.x({
      file: tarPath,
      cwd: tempDir,
    });

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("extracting"));

    // Step 4: Find app directory
    const appDir = findAppDirectory(tempDir);
    if (!appDir) {
      throw new Error("Could not find app directory in template");
    }

    // Step 5: Write config to resources directory
    console.log(`[Domestic Linux Build ${buildId}] Writing config...`);
    const resourcesDir = path.join(appDir, "resources");
    fs.mkdirSync(resourcesDir, { recursive: true });

    const appConfig = {
      url: config.url,
      title: config.appName,
    };
    const configPath = path.join(resourcesDir, "app-config.json");
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    // Step 5.1: Replace placeholders in install.sh
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, "").trim() || "App";
    const installShPath = path.join(appDir, "install.sh");
    if (fs.existsSync(installShPath)) {
      let installScript = fs.readFileSync(installShPath, "utf-8");
      installScript = installScript.replace(/\{\{APP_NAME\}\}/g, safeAppName);
      fs.writeFileSync(installShPath, installScript, "utf-8");
      console.log(`[Domestic Linux Build ${buildId}] Updated install.sh with app name:`, safeAppName);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("configuring"));

    // Step 6: Replace icon if provided
    if (config.iconPath) {
      console.log(`[Domestic Linux Build ${buildId}] Replacing icon...`);
      await replaceAppIcon(storage, resourcesDir, config.iconPath);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_icons"));

    // Step 7: Rename directory
    const newAppDir = path.join(tempDir, safeAppName);
    if (appDir !== newAppDir) {
      fs.renameSync(appDir, newAppDir);
    }

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    // Step 8: Create tar.gz archive with archiver
    console.log(`[Domestic Linux Build ${buildId}] Creating tar.gz archive...`);
    const archiver = (await import("archiver")).default;

    const outputBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
      passThrough.on("end", () => resolve(Buffer.concat(chunks)));
      passThrough.on("error", reject);

      const archive = archiver("tar", { gzip: true, gzipOptions: { level: 9 } });
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
            const isExecutable = entry.name === "install.sh" ||
                                 entry.name === "tauri-shell" ||
                                 !entry.name.includes(".");
            const mode = isExecutable ? 0o755 : 0o644;

            archive.append(fileData, { name: entryZipPath, mode });
          }
        }
      };

      addFolderToArchive(newAppDir, safeAppName);
      archive.finalize();
    });

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("uploading"));

    // Step 9: Upload result
    console.log(`[Domestic Linux Build ${buildId}] Uploading result...`);
    const outputPath = `user-builds/builds/${buildId}/${safeAppName}.tar.gz`;
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

    console.log(`[Domestic Linux Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "linux",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic Linux Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic Linux Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "linux",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic Linux Build ${buildId}] Failed to track build failure event:`, err);
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

  // Find directory containing executable or resources
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "__MACOSX") {
      const subDir = path.join(baseDir, entry.name);
      if (fs.existsSync(path.join(subDir, "tauri-shell")) ||
          fs.existsSync(path.join(subDir, "resources"))) {
        return subDir;
      }
    }
  }

  // If not found, return first non-hidden directory
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "__MACOSX") {
      return path.join(baseDir, entry.name);
    }
  }

  return null;
}

async function replaceAppIcon(
  storage: ReturnType<typeof getCloudBaseStorage>,
  resourcesDir: string,
  iconPath: string
): Promise<void> {
  try {
    const iconBuffer = await storage.downloadFile(iconPath);

    const processedIcon = await sharp(iconBuffer)
      .resize(512, 512, { fit: "cover" })
      .png()
      .toBuffer();

    const iconOutputPath = path.join(resourcesDir, "icon.png");
    fs.writeFileSync(iconOutputPath, processedIcon);

    console.log("[Domestic Linux Build] Icon replaced successfully");
  } catch (error) {
    console.warn("[Domestic Linux Build] Icon replacement failed:", error);
  }
}
