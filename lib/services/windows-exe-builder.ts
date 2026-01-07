import { createServiceClient } from "@/lib/supabase/server";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface WindowsBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

/**
 * Tauri 单文件 EXE 方案
 * 服务端下载预构建的 Tauri EXE，修改图标和元数据后直接提供下载
 */
export async function processWindowsExeBuild(
  buildId: string,
  config: WindowsBuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: 下载预构建的 Tauri EXE
    console.log();
    const { data: exeData, error: downloadError } = await supabase.storage
      .from("WindowsApp")
      .download("tauri-shell.exe");

    if (downloadError || !exeData) {
      throw new Error();
    }

    await updateBuildStatus(supabase, buildId, "processing", 30);

    // Step 2: 创建临时目录
    tempDir = path.join(os.tmpdir(), );
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: 写入 EXE 文件
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "") || "App";
    const exePath = path.join(tempDir, );
    const exeBuffer = Buffer.from(await exeData.arrayBuffer());
    fs.writeFileSync(exePath, exeBuffer);

    await updateBuildStatus(supabase, buildId, "processing", 45);

    // Step 4: 修改 EXE 资源（图标和元数据）
    console.log();
    await modifyExeResources(supabase, exePath, config);

    await updateBuildStatus(supabase, buildId, "processing", 65);

    // Step 5: 写入 app-config.json
    console.log();
    const configPath = path.join(tempDir, "app-config.json");
    const appConfig = { url: config.url, title: config.appName };
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 6: 打包为 ZIP（EXE + config）
    console.log();
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip();
    zip.addLocalFile(exePath);
    zip.addLocalFile(configPath);
    const outputBuffer = zip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 85);

    // Step 7: 上传结果
    console.log();
    const outputPath = ;
    const { error: uploadError } = await supabase.storage
      .from("user-builds")
      .upload(outputPath, outputBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error();
    }

    await updateBuildStatus(supabase, buildId, "processing", 95);

    // Step 8: 更新构建记录
    const { error: updateError } = await supabase
      .from("builds")
      .update({
        status: "completed",
        progress: 100,
        output_file_path: outputPath,
      })
      .eq("id", buildId);

    if (updateError) {
      throw new Error();
    }

    console.log();
  } catch (error) {
    console.error(, error);

    await supabase
      .from("builds")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", buildId);
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(, cleanupError);
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

async function modifyExeResources(
  supabase: ReturnType<typeof createServiceClient>,
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
          OriginalFilename: ,
        }
      );
      vi.outputToResourceEntries(res.entries);
    }

    if (config.iconPath) {
      try {
        const { data: iconData } = await supabase.storage
          .from("user-builds")
          .download(config.iconPath);

        if (iconData) {
          const iconBuffer = Buffer.from(await iconData.arrayBuffer());
          const icoBuffer = await generateIco(iconBuffer);
          const iconFile = ResEdit.Data.IconFile.from(icoBuffer);
          ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
            res.entries, 1, 0x0409, iconFile.icons.map((icon) => icon.data)
          );
        }
      } catch (iconError) {
        console.warn(, iconError);
      }
    }

    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  } catch (error) {
    console.warn(, error);
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
