import { createServiceClient } from "@/lib/supabase/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PassThrough } from "stream";

interface LinuxBuildConfig {
  url: string;
  appName: string;
  iconPath: string | null;
}

/**
 * Linux App 构建服务
 *
 * 采用与 macOS 类似的策略：
 * 1. 从 Supabase Storage 下载预构建的 Linux 模板（tar.gz 格式）
 * 2. 解压并修改配置文件（app-config.json）
 * 3. 替换图标（如果提供）
 * 4. 重新打包并上传
 *
 * 预构建模板需要通过 GitHub Actions 在 Linux runner 上编译
 */
export async function processLinuxAppBuild(
  buildId: string,
  config: LinuxBuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: 下载预构建的 Linux App 模板 (tar.gz 格式)
    console.log("[Linux Build] Downloading template...");
    const { data: templateData, error: downloadError } = await supabase.storage
      .from("LinuxApp")
      .download("tauri-shell.tar.gz");

    if (downloadError || !templateData) {
      throw new Error(`Failed to download Linux template: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 25);

    // Step 2: 创建临时目录
    tempDir = path.join(os.tmpdir(), `linux-build-${buildId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 3: 解压模板
    console.log("[Linux Build] Extracting template...");
    const templateBuffer = Buffer.from(await templateData.arrayBuffer());
    const tarPath = path.join(tempDir, "template.tar.gz");
    fs.writeFileSync(tarPath, templateBuffer);

    // 使用 tar 库解压
    const tar = await import("tar");
    await tar.x({
      file: tarPath,
      cwd: tempDir,
    });

    await updateBuildStatus(supabase, buildId, "processing", 40);

    // Step 4: 查找解压后的目录
    const appDir = findAppDirectory(tempDir);
    if (!appDir) {
      throw new Error("Could not find app directory in template");
    }

    // Step 5: 写入配置文件到 resources 目录
    console.log("[Linux Build] Writing config...");
    const resourcesDir = path.join(appDir, "resources");
    fs.mkdirSync(resourcesDir, { recursive: true });

    const appConfig = {
      url: config.url,
      title: config.appName,
    };
    const configPath = path.join(resourcesDir, "app-config.json");
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf-8");

    await updateBuildStatus(supabase, buildId, "processing", 55);

    // Step 6: 替换图标（如果提供）
    if (config.iconPath) {
      console.log("[Linux Build] Replacing icon...");
      await replaceAppIcon(supabase, resourcesDir, config.iconPath);
    }

    await updateBuildStatus(supabase, buildId, "processing", 65);

    // Step 7: 重命名可执行文件和目录
    const safeAppName = config.appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, "").trim() || "App";
    const safeExeName = safeAppName.toLowerCase().replace(/\s+/g, "-");

    // 查找并重命名可执行文件
    const oldExePath = path.join(appDir, "tauri-shell");
    const newExePath = path.join(appDir, safeExeName);
    if (fs.existsSync(oldExePath) && oldExePath !== newExePath) {
      fs.renameSync(oldExePath, newExePath);
    }

    // 重命名目录
    const newAppDir = path.join(tempDir, safeAppName);
    if (appDir !== newAppDir) {
      fs.renameSync(appDir, newAppDir);
    }

    await updateBuildStatus(supabase, buildId, "processing", 75);

    // Step 8: 打包为 tar.gz（使用 archiver 正确设置 Unix 可执行权限）
    console.log("[Linux Build] Creating tar.gz archive with archiver...");
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

      // 递归添加文件并设置正确的 Unix 权限
      const addFolderToArchive = (folderPath: string, zipPath: string) => {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(folderPath, entry.name);
          const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            addFolderToArchive(fullPath, entryZipPath);
          } else {
            const fileData = fs.readFileSync(fullPath);
            // 检查是否是可执行文件（与目录同名或名为 tauri-shell）
            const isExecutable = entry.name === safeExeName ||
                                 entry.name === "tauri-shell" ||
                                 !entry.name.includes(".");
            // Unix 权限: 0o755 (rwxr-xr-x) 用于可执行文件, 0o644 (rw-r--r--) 用于普通文件
            const mode = isExecutable ? 0o755 : 0o644;

            archive.append(fileData, { name: entryZipPath, mode });
          }
        }
      };

      addFolderToArchive(newAppDir, safeAppName);
      archive.finalize();
    });

    await updateBuildStatus(supabase, buildId, "processing", 85);

    // Step 9: 上传结果
    console.log("[Linux Build] Uploading result...");
    const outputPath = `builds/${buildId}/${safeAppName}.tar.gz`;
    const { error: uploadError } = await supabase.storage
      .from("user-builds")
      .upload(outputPath, outputBuffer, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload result: ${uploadError.message}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 95);

    // Step 10: 更新构建记录
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

    console.log("[Linux Build] Build completed successfully!");
  } catch (error) {
    console.error("[Linux Build] Error:", error);

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
        console.warn("[Linux Build] Cleanup error:", cleanupError);
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

  // 查找包含可执行文件的目录
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "__MACOSX") {
      const subDir = path.join(baseDir, entry.name);
      // 检查是否包含 tauri-shell 可执行文件或 resources 目录
      if (fs.existsSync(path.join(subDir, "tauri-shell")) ||
          fs.existsSync(path.join(subDir, "resources"))) {
        return subDir;
      }
    }
  }

  // 如果没找到，返回第一个非隐藏目录
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "__MACOSX") {
      return path.join(baseDir, entry.name);
    }
  }

  return null;
}

async function replaceAppIcon(
  supabase: ReturnType<typeof createServiceClient>,
  resourcesDir: string,
  iconPath: string
): Promise<void> {
  try {
    // 下载用户图标
    const { data: iconData, error: iconError } = await supabase.storage
      .from("user-builds")
      .download(iconPath);

    if (iconError || !iconData) {
      console.warn("[Linux Build] Failed to download icon:", iconError);
      return;
    }

    const iconBuffer = Buffer.from(await iconData.arrayBuffer());

    // 使用 sharp 处理图标（缩放到 512x512）
    const sharp = (await import("sharp")).default;
    const processedIcon = await sharp(iconBuffer)
      .resize(512, 512, { fit: "cover" })
      .png()
      .toBuffer();

    // 写入到 resources 目录
    const iconOutputPath = path.join(resourcesDir, "icon.png");
    fs.writeFileSync(iconOutputPath, processedIcon);

    console.log("[Linux Build] Icon replaced successfully");
  } catch (error) {
    console.warn("[Linux Build] Icon replacement failed:", error);
  }
}
