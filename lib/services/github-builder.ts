/**
 * GitHub Actions 构建服务
 * 用于触发 GitHub Actions workflow 构建 Android APK
 */

import { githubRateLimiter } from './github-rate-limiter';
import { monitoring } from './monitoring';

// 下载去重：记录正在下载的artifact，避免重复下载
const downloadingArtifacts = new Map<string, Promise<Buffer | null>>();

// 记录 runId 对应的 repo，用于状态查询和 artifact 下载
const runIdToRepo = new Map<string, string>();

// 缓存仓库默认分支（5 分钟 TTL）
const defaultBranchCache = new Map<string, { branch: string; cachedAt: number }>();
const BRANCH_CACHE_TTL = 5 * 60 * 1000;

/**
 * 根据平台类型获取 GitHub 仓库和 workflow 配置
 */
function getGitHubRepoConfig(platform: "android-apk" | "ios-ipa" | "harmonyos-hap"): {
  repo: string | undefined;
  workflowFile: string;
} {
  switch (platform) {
    case "android-apk":
      return {
        repo: process.env.GITHUB_APK_REPO?.trim(),
        workflowFile: "build-android-apk.yml",
      };
    case "ios-ipa":
      return {
        repo: process.env.GITHUB_IPA_REPO?.trim(),
        workflowFile: "build-ios-ipa.yml",
      };
    case "harmonyos-hap":
      return {
        repo: process.env.GITHUB_HAP_REPO?.trim(),
        workflowFile: "build-harmonyos-hap.yml",
      };
  }
}

/**
 * 根据 runId 获取对应的 GitHub 仓库
 * 优先从缓存获取，如果没有则尝试所有仓库
 */
function getGitHubRepoForPlatform(runId: string): string | undefined {
  // 先从缓存获取
  if (runIdToRepo.has(runId)) {
    return runIdToRepo.get(runId);
  }
  // 回退到 APK 仓库（兼容旧的构建记录）
  return process.env.GITHUB_APK_REPO?.trim();
}

interface GitHubBuildConfig {
  buildId: string;
  sourceUrl: string;
  callbackUrl?: string;
  platform: "android-apk" | "ios-ipa" | "harmonyos-hap";
}

interface GitHubBuildResult {
  success: boolean;
  runId?: string;
  error?: string;
}

/**
 * 触发 GitHub Actions workflow 构建 APK
 */
export async function triggerGitHubBuild(
  config: GitHubBuildConfig
): Promise<GitHubBuildResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();

  // Select repo and workflow based on platform
  const { repo, workflowFile } = getGitHubRepoConfig(config.platform);

  if (!token || !owner || !repo) {
    console.error(`[GitHub Build] Missing config for ${config.platform}:`, {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPrefix: token?.substring(0, 4) || "(empty)",
      owner: owner || "(empty)",
      repo: repo || "(empty)",
      rawToken: process.env.GITHUB_TOKEN ? `(set, len=${process.env.GITHUB_TOKEN.length})` : "(unset)",
      rawOwner: process.env.GITHUB_OWNER || "(unset)",
      rawIpaRepo: process.env.GITHUB_IPA_REPO || "(unset)",
      rawHapRepo: process.env.GITHUB_HAP_REPO || "(unset)",
      rawApkRepo: process.env.GITHUB_APK_REPO || "(unset)",
    });
    return {
      success: false,
      error: `GitHub configuration missing for platform ${config.platform} (GITHUB_TOKEN=${!!token}, GITHUB_OWNER=${!!owner}, repo=${!!repo})`,
    };
  }

  try {
    // Get default branch (cached for 5 minutes)
    const cacheKey = `${owner}/${repo}`;
    const cached = defaultBranchCache.get(cacheKey);
    let defaultBranch = "main";

    if (cached && Date.now() - cached.cachedAt < BRANCH_CACHE_TTL) {
      defaultBranch = cached.branch;
    } else {
      try {
        const repoInfoResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        if (repoInfoResp.ok) {
          const repoInfo = await repoInfoResp.json();
          defaultBranch = repoInfo.default_branch || "main";
          defaultBranchCache.set(cacheKey, { branch: defaultBranch, cachedAt: Date.now() });
        }
      } catch (e) {
        console.warn("[GitHub Build] Failed to get default branch, using 'main'");
      }
    }

    console.log(`[GitHub Build] Dispatching workflow ${workflowFile} on ${owner}/${repo} ref=${defaultBranch}`);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: defaultBranch,
          inputs: {
            build_id: config.buildId,
            source_url: config.sourceUrl,
            callback_url: config.callbackUrl || "",
          },
        }),
      }
    );

    // 更新速率限制信息
    githubRateLimiter.updateRateLimit(response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GitHub Build] API error:", errorText);
      return {
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    console.log(`[GitHub Build] Workflow triggered for build ${config.buildId}`);

    // 短间隔重试获取 workflow run ID（替代固定 2s 等待）
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const runsResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );

        githubRateLimiter.updateRateLimit(runsResponse.headers);

        if (runsResponse.ok) {
          const runsData = await runsResponse.json();
          const latestRun = runsData.workflow_runs?.[0];
          if (latestRun) {
            console.log(`[GitHub Build] Found run ID: ${latestRun.id} (attempt ${attempt + 1})`);
            runIdToRepo.set(String(latestRun.id), repo);
            return {
              success: true,
              runId: String(latestRun.id),
            };
          }
        }
      } catch (error) {
        console.warn(`[GitHub Build] Failed to get run ID (attempt ${attempt + 1}):`, error);
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("[GitHub Build] Error:", error);
    console.error("[GitHub Build] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      cause: error instanceof Error ? error.cause : undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 获取 GitHub Actions workflow 运行状态
 */
export async function getGitHubBuildStatus(
  runId: string,
  platform?: "android-apk" | "ios-ipa" | "harmonyos-hap"
): Promise<{
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled";
  error?: string;
}> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  // 优先使用平台参数查找仓库，回退到 runId 缓存
  const repo = platform
    ? getGitHubRepoConfig(platform).repo
    : getGitHubRepoForPlatform(runId);

  if (!token || !owner || !repo) {
    return {
      status: "completed",
      conclusion: "failure",
      error: "GitHub configuration missing",
    };
  }

  // 检查速率限制
  if (githubRateLimiter.isNearLimit()) {
    console.warn('[GitHub API] ⚠️ Near rate limit, consider reducing request frequency');
  }

  try {
    // 记录 GitHub API 调用
    monitoring.recordApiCall('github_api', true);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    // 更新速率限制信息
    githubRateLimiter.updateRateLimit(response.headers);

    if (!response.ok) {
      return {
        status: "completed",
        conclusion: "failure",
        error: `GitHub API error: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      status: data.status,
      conclusion: data.conclusion,
    };
  } catch (error) {
    // 记录 GitHub API 调用失败
    monitoring.recordApiCall('github_api', false);

    return {
      status: "completed",
      conclusion: "failure",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 下载 GitHub Actions 构建产物
 */
export async function downloadGitHubArtifact(
  runId: string,
  artifactName: string,
  platform?: "android-apk" | "ios-ipa" | "harmonyos-hap"
): Promise<Buffer | null> {
  // 下载去重：如果同一个artifact正在下载，等待现有下载完成
  const downloadKey = `${runId}-${artifactName}`;
  if (downloadingArtifacts.has(downloadKey)) {
    return downloadingArtifacts.get(downloadKey)!;
  }

  // 创建下载Promise并缓存
  const downloadPromise = performDownload(runId, artifactName, platform);
  downloadingArtifacts.set(downloadKey, downloadPromise);

  // 下载完成后清理缓存
  downloadPromise.finally(() => {
    downloadingArtifacts.delete(downloadKey);
  });

  return downloadPromise;
}

/**
 * 执行实际的下载操作
 */
async function performDownload(
  runId: string,
  artifactName: string,
  platform?: "android-apk" | "ios-ipa" | "harmonyos-hap"
): Promise<Buffer | null> {
  console.log(`[GitHub] 📥 Downloading ${artifactName}`);

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = platform
    ? getGitHubRepoConfig(platform).repo
    : getGitHubRepoForPlatform(runId);

  if (!token || !owner || !repo) {
    console.error("[GitHub] ❌ Configuration missing");
    return null;
  }

  try {
    // 1. 获取 artifacts 列表
    const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;

    const artifactsResponse = await fetch(artifactsUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!artifactsResponse.ok) {
      console.error(`[GitHub] ❌ Failed to get artifacts: ${artifactsResponse.status}`);
      return null;
    }

    const artifactsData = await artifactsResponse.json();
    const artifact = artifactsData.artifacts.find(
      (a: any) => a.name === artifactName
    );

    if (!artifact) {
      console.error(`[GitHub] ❌ Artifact not found`);
      return null;
    }

    console.log(`[GitHub] 📦 Size: ${(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB`);

    // 2. 下载 artifact
    const downloadResponse = await fetch(artifact.archive_download_url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!downloadResponse.ok) {
      console.error(`[GitHub] ❌ Download failed: ${downloadResponse.status}`);
      return null;
    }

    try {
      // 使用流式读取代替 arrayBuffer()，避免大文件超时
      const chunks: Uint8Array[] = [];
      const reader = downloadResponse.body?.getReader();

      if (!reader) {
        console.error(`[GitHub] ❌ No response body reader`);
        return null;
      }

      let totalBytes = 0;
      let lastLoggedMB = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        totalBytes += value.length;

        // 每下载1MB输出一次进度
        const currentMB = Math.floor(totalBytes / (1024 * 1024));
        if (currentMB > lastLoggedMB) {
          lastLoggedMB = currentMB;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const speed = (totalBytes / 1024 / 1024 / (Date.now() - startTime) * 1000).toFixed(2);
          console.log(`[GitHub] 📊 ${(totalBytes / 1024 / 1024).toFixed(2)} MB in ${elapsed}s (${speed} MB/s)`);
        }
      }

      const buffer = Buffer.concat(chunks);
      console.log(`[GitHub] ✅ Download complete: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      return buffer;
    } catch (bufferError) {
      console.error(`[GitHub] ❌ Stream error:`, bufferError instanceof Error ? bufferError.message : String(bufferError));
      return null;
    }
  } catch (error) {
    console.error("[GitHub] ❌ Download error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 设置 runId 对应的 repo（供外部回调使用）
 */
export function setRunIdRepo(runId: string, platform: "android-apk" | "ios-ipa" | "harmonyos-hap") {
  const { repo } = getGitHubRepoConfig(platform);
  if (repo) {
    runIdToRepo.set(runId, repo);
  }
}
