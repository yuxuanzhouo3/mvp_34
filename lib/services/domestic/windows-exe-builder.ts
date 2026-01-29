/**
 * 国内版 Windows 构建服务
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

interface WindowsBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

export async function processWindowsExeBuildDomestic(
  buildId: string,
  config: WindowsBuildConfig
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  let tempDir: string | null = null;
  let userId: string | null = null;
  const buildStartTime = Date.now();
  const progressHelper = new BuildProgressHelper("windows");

  try {
    // 获取构建记录以获取 user_id
    const buildRecord = await db.collection("builds").doc(buildId).get();
    userId = buildRecord?.data?.[0]?.user_id || null;

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("initializing"));

    // Step 1: Download pre-built Tauri EXE (直接是 exe 文件，不是 zip)
    console.log(`[Domestic Windows Build ${buildId}] Downloading tauri-shell.exe...`);
    const exeBuffer = await storage.downloadFile("WindowsApp/tauri-shell.exe");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("downloading"));

    // Step 2: Create temp directory
    tempDir = path.join(os.tmpdir(), `windows-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: Write EXE file
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "") || "App";
    const exePath = path.join(tempDir, `${safeAppName}.exe`);
    fs.writeFileSync(exePath, exeBuffer);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("configuring"));

    // Step 4: Modify EXE resources (icon and metadata)
    console.log(`[Domestic Windows Build ${buildId}] Modifying resources...`);
    await modifyExeResources(storage, exePath, config);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("processing_icons"));

    // Step 5: Write app-config.json
    console.log(`[Domestic Windows Build ${buildId}] Writing config...`);
    const configPath = path.join(tempDir, "app-config.json");
    const appConfig = { url: config.url, title: config.appName };
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    // Step 6: Package as ZIP (EXE + config)
    console.log(`[Domestic Windows Build ${buildId}] Creating ZIP archive...`);
    const zip = new AdmZip();
    zip.addLocalFile(exePath);
    zip.addLocalFile(configPath);
    const outputBuffer = zip.toBuffer();

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("uploading"));

    // Step 7: Upload result
    console.log(`[Domestic Windows Build ${buildId}] Uploading result...`);
    const outputPath = `user-builds/builds/${buildId}/${safeAppName}.zip`;
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

    console.log(`[Domestic Windows Build ${buildId}] Completed successfully!`);

    // 记录构建完成事件用于统计
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "windows",
        success: true,
        durationMs: Date.now() - buildStartTime,
      }).catch((err) => {
        console.error(`[Domestic Windows Build ${buildId}] Failed to track build complete event:`, err);
      });
    }
  } catch (error) {
    console.error(`[Domestic Windows Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 记录构建失败事件
    if (userId) {
      await trackBuildCompleteEvent(userId, {
        buildId,
        platform: "windows",
        success: false,
        durationMs: Date.now() - buildStartTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch((err) => {
        console.error(`[Domestic Windows Build ${buildId}] Failed to track build failure event:`, err);
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

async function modifyExeResources(
  storage: ReturnType<typeof getCloudBaseStorage>,
  exePath: string,
  config: WindowsBuildConfig
): Promise<void> {
  try {
    const ResEdit = await import("resedit");
    const exeData = fs.readFileSync(exePath);
    const exe = ResEdit.NtExecutable.from(exeData);
    const res = ResEdit.NtExecutableResource.from(exe);

    const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
    if (viList.length > 0) {
      const vi = viList[0];
      vi.setStringValues(
        { lang: 0x0409, codepage: 1200 },
        {
          ProductName: config.appName,
          FileDescription: config.appName,
          CompanyName: "",
          LegalCopyright: "",
          InternalName: config.appName,
          OriginalFilename: `${config.appName}.exe`,
        }
      );
      vi.outputToResourceEntries(res.entries);
    }

    if (config.iconPath) {
      try {
        const iconBuffer = await storage.downloadFile(config.iconPath);
        const icoBuffer = await generateIco(iconBuffer);
        const iconFile = ResEdit.Data.IconFile.from(icoBuffer);
        ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
          res.entries, 1, 0x0409, iconFile.icons.map((icon) => icon.data)
        );
      } catch (iconError) {
        console.warn("[Domestic Windows Build] Icon replacement failed:", iconError);
      }
    }

    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  } catch (error) {
    console.warn("[Domestic Windows Build] Resource modification failed:", error);
  }
}

async function generateIco(pngBuffer: Buffer): Promise<Buffer> {
  const sizes = [16, 32, 48, 256];
  const images: Buffer[] = [];

  for (const size of sizes) {
    const resized = await sharp(pngBuffer)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer();
    images.push(resized);
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  let dataOffset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirEntries: Buffer[] = [];
  for (let i = 0; i < images.length; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const size = sizes[i] === 256 ? 0 : sizes[i];
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += images[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...images]);
}
