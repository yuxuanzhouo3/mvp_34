/**
 * 国内版 Windows 构建服务
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

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("packaging"));

    // Step 5: Read modified EXE
    const outputBuffer = fs.readFileSync(exePath);

    await updateBuildStatus(db, buildId, "processing", progressHelper.getProgressForStage("uploading"));

    // Step 6: Upload result (single EXE file)
    console.log(`[Domestic Windows Build ${buildId}] Uploading result...`);
    const outputPath = `user-builds/builds/${buildId}/${safeAppName}.exe`;
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
        console.log("[Domestic Windows Build] Icon replaced successfully");
      } catch (iconError) {
        console.warn("[Domestic Windows Build] Icon replacement failed:", iconError);
      }
    }

    // Embed app config into APPCONFIG resource
    const appConfig = { url: config.url, title: config.appName };
    const configJson = JSON.stringify(appConfig);
    const configBuffer = Buffer.from(configJson, "utf-8");

    res.entries.push({
      type: "APPCONFIG",
      id: 1,
      lang: 0x0409,
      codepage: 1200,
      bin: configBuffer.buffer.slice(configBuffer.byteOffset, configBuffer.byteOffset + configBuffer.byteLength),
    });
    console.log("[Domestic Windows Build] Embedded config into APPCONFIG resource");

    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
    console.log("[Domestic Windows Build] EXE resources modified successfully");
  } catch (error) {
    console.warn("[Domestic Windows Build] Resource modification failed:", error);
  }
}

async function generateIco(pngBuffer: Buffer): Promise<Buffer> {
  // Generate multiple sizes for better Windows compatibility
  const sizes = [16, 32, 48, 64, 128, 256];
  const images: Buffer[] = [];

  for (const size of sizes) {
    // Convert to BMP format (required for ICO)
    const bmpData = await sharp(pngBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create BMP header for ICO
    const { data, info } = bmpData;
    const width = info.width;
    const height = info.height;
    const bpp = 32; // 32-bit RGBA

    // BMP Info Header (40 bytes)
    const infoHeader = Buffer.alloc(40);
    infoHeader.writeUInt32LE(40, 0); // Header size
    infoHeader.writeInt32LE(width, 4); // Width
    infoHeader.writeInt32LE(height * 2, 8); // Height * 2 (ICO format)
    infoHeader.writeUInt16LE(1, 12); // Planes
    infoHeader.writeUInt16LE(bpp, 14); // Bits per pixel
    infoHeader.writeUInt32LE(0, 16); // Compression (none)
    infoHeader.writeUInt32LE(data.length, 20); // Image size

    // Convert RGBA to BGRA and flip vertically (BMP format)
    const bgraData = Buffer.alloc(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = ((height - 1 - y) * width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        bgraData[dstIdx] = data[srcIdx + 2]; // B
        bgraData[dstIdx + 1] = data[srcIdx + 1]; // G
        bgraData[dstIdx + 2] = data[srcIdx]; // R
        bgraData[dstIdx + 3] = data[srcIdx + 3]; // A
      }
    }

    images.push(Buffer.concat([infoHeader, bgraData]));
  }

  // ICO header
  const headerSize = 6;
  const dirEntrySize = 16;
  let dataOffset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type (1 = ICO)
  header.writeUInt16LE(images.length, 4); // Number of images

  // Directory entries
  const dirEntries: Buffer[] = [];
  for (let i = 0; i < images.length; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const size = sizes[i];
    entry.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(images[i].length, 8); // Image size
    entry.writeUInt32LE(dataOffset, 12); // Image offset
    dataOffset += images[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...images]);
}
