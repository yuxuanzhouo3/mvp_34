import { createServiceClient } from "@/lib/supabase/server";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface WechatBuildConfig {
  url: string;
  appName: string;
  appId: string;
  version: string;
}

export async function processWechatBuild(
  buildId: string,
  config: WechatBuildConfig
): Promise<void> {
  const supabase = createServiceClient();
  let tempDir: string | null = null;

  try {
    // Update status to processing
    await updateBuildStatus(supabase, buildId, "processing", 5);

    // Step 1: Download wechat.zip from Storage
    console.log(`[Build ${buildId}] Downloading wechat.zip...`);
    const { data: zipData, error: downloadError } = await supabase.storage
      .from("WeChat")
      .download("wechat.zip");

    if (downloadError || !zipData) {
      throw new Error(`Failed to download wechat.zip: ${downloadError?.message || "No data"}`);
    }

    await updateBuildStatus(supabase, buildId, "processing", 20);

    // Step 2: Extract zip to temp directory
    console.log(`[Build ${buildId}] Extracting zip...`);
    tempDir = path.join(os.tmpdir(), `wechat-build-${buildId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipBuffer = Buffer.from(await zipData.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    await updateBuildStatus(supabase, buildId, "processing", 35);

    // Step 2.5: Find the actual project root (folder containing 'app.json')
    const projectRoot = findProjectRoot(tempDir);
    if (!projectRoot) {
      throw new Error("Invalid zip structure: cannot find 'app.json'");
    }
    console.log(`[Build ${buildId}] Project root found: ${projectRoot}`);

    // Step 3: Update appConfig.js
    console.log(`[Build ${buildId}] Updating appConfig.js...`);
    const appConfigPath = path.join(projectRoot, "appConfig.js");
    if (fs.existsSync(appConfigPath)) {
      await updateAppConfig(appConfigPath, config);
    } else {
      console.warn(`[Build ${buildId}] appConfig.js not found, creating new one`);
      await createAppConfig(appConfigPath, config);
    }

    await updateBuildStatus(supabase, buildId, "processing", 50);

    // Step 4: Update project.config.json
    console.log(`[Build ${buildId}] Updating project.config.json...`);
    const projectConfigPath = path.join(projectRoot, "project.config.json");
    if (fs.existsSync(projectConfigPath)) {
      await updateProjectConfig(projectConfigPath, config);
    }

    await updateBuildStatus(supabase, buildId, "processing", 80);

    // Step 5: Repack zip
    console.log(`[Build ${buildId}] Repacking zip...`);
    const newZip = new AdmZip();
    addFolderToZip(newZip, tempDir, "");
    const outputBuffer = newZip.toBuffer();

    await updateBuildStatus(supabase, buildId, "processing", 90);

    // Step 8: Upload result
    console.log(`[Build ${buildId}] Uploading result...`);
    const outputPath = `builds/${buildId}/wechat-source.zip`;
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

    // Step 9: Update build record with output path
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

/**
 * 递归查找包含 'app.json' 的项目根目录
 */
function findProjectRoot(dir: string, maxDepth: number = 3): string | null {
  // 检查当前目录是否包含 'app.json'
  const appJsonPath = path.join(dir, "app.json");
  if (fs.existsSync(appJsonPath)) {
    return dir;
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

async function updateAppConfig(configPath: string, config: WechatBuildConfig): Promise<void> {
  const configContent = fs.readFileSync(configPath, "utf-8");

  // Parse JS module content to extract the config object
  // The format is: module.exports = { ... };
  const match = configContent.match(/module\.exports\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) {
    // If can't parse, create new config
    await createAppConfig(configPath, config);
    return;
  }

  try {
    // Use Function constructor to safely evaluate the object literal
    const evalFunc = new Function(`return ${match[1]}`);
    const appConfig = evalFunc();

    // Only update essential fields: url, appName, appId, version
    if (appConfig.general) {
      appConfig.general.initialUrl = config.url;
      appConfig.general.appName = config.appName;
      appConfig.general.appId = config.appId;
      appConfig.general.version = config.version;
    }

    // Write back as JS module
    const newContent = `// appConfig.js - 集中化配置文件
module.exports = ${JSON.stringify(appConfig, null, 2)};
`;
    fs.writeFileSync(configPath, newContent, "utf-8");
  } catch {
    // If parsing fails, create new config
    await createAppConfig(configPath, config);
  }
}

async function createAppConfig(configPath: string, config: WechatBuildConfig): Promise<void> {
  const appConfig = {
    general: {
      initialUrl: config.url,
      appName: config.appName,
      appId: config.appId,
      version: config.version
    },
    login: {
      enableWxLogin: true,
      defaultAvatarUrl: "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0"
    }
  };

  const content = `// appConfig.js - 集中化配置文件
module.exports = ${JSON.stringify(appConfig, null, 2)};
`;
  fs.writeFileSync(configPath, content, "utf-8");
}

async function updateProjectConfig(configPath: string, config: WechatBuildConfig): Promise<void> {
  const configContent = fs.readFileSync(configPath, "utf-8");
  const projectConfig = JSON.parse(configContent);

  // Only update appid, keep projectname as default
  projectConfig.appid = config.appId;

  fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2), "utf-8");
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
