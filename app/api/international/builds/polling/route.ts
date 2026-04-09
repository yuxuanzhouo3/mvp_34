/**
 * 国际版构建状态轮询接口（带自动同步）
 * 只返回 pending/processing 状态，减少轮询数据量
 * 自动检测并同步 GitHub Actions 云端构建（APK/IPA/HAP）
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getGitHubBuildStatus, downloadGitHubArtifact } from "@/lib/services/github-builder";
import { githubRateLimiter } from "@/lib/services/github-rate-limiter";
import AdmZip from "adm-zip";

export const maxDuration = 120;

// 防止并发同步
const syncingBuilds = new Set<string>();
const completedBuilds = new Map<string, number>();
const COMPLETED_CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: processingBuilds, error } = await serviceClient
      .from("builds")
      .select("id,status,progress,platform,github_run_id,output_file_path,updated_at")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[International Polling] Query error:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to fetch processing builds" },
        { status: 500 }
      );
    }

    // Auto-sync GitHub Actions builds
    if (processingBuilds && processingBuilds.length > 0) {
      try {
        await autoSyncBuilds(serviceClient, processingBuilds);
      } catch (syncError) {
        console.error("[International Polling] Auto-sync error:", syncError);
      }

      // Re-query to get fresh status
      const { data: refreshed } = await serviceClient
        .from("builds")
        .select("id,status,progress,platform")
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])
        .gte("created_at", oneHourAgo)
        .order("created_at", { ascending: false })
        .limit(20);

      return NextResponse.json({
        builds: (refreshed || []).map((b) => ({
          id: b.id, status: b.status, progress: b.progress, platform: b.platform,
        })),
      });
    }

    return NextResponse.json({
      builds: (processingBuilds || []).map((b) => ({
        id: b.id, status: b.status, progress: b.progress, platform: b.platform,
      })),
    });
  } catch (error) {
    console.error("[International Polling] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function autoSyncBuilds(
  supabase: ReturnType<typeof createServiceClient>,
  builds: any[]
) {
  const now = Date.now();

  // Clean expired cache
  for (const [id, ts] of completedBuilds.entries()) {
    if (now - ts > COMPLETED_CACHE_TTL) completedBuilds.delete(id);
  }

  if (githubRateLimiter.shouldThrottle()) {
    console.warn("[International AutoSync] GitHub API rate limit high, skipping");
    return;
  }

  const supportedPlatforms = ["android-apk", "ios-ipa", "harmonyos-hap"];

  for (const build of builds) {
    if (!supportedPlatforms.includes(build.platform)) continue;
    if (!build.github_run_id) continue;
    if (completedBuilds.has(build.id)) continue;
    if (syncingBuilds.has(build.id)) continue;

    // Skip if artifact already uploaded
    const alreadyUploaded = build.output_file_path &&
      (build.output_file_path.endsWith('.apk') ||
       build.output_file_path.endsWith('.ipa') ||
       build.output_file_path.endsWith('.hap'));
    if (alreadyUploaded) continue;

    syncingBuilds.add(build.id);
    console.log(`[International AutoSync] Checking build ${build.id} (${build.platform})`);

    try {
      const status = await getGitHubBuildStatus(build.github_run_id, build.platform);

      if (status.error) {
        console.error(`[International AutoSync] GitHub status error: ${status.error}`);
        continue;
      }

      if (status.status === "completed" && status.conclusion === "success") {
        console.log(`[International AutoSync] Build completed, downloading artifact...`);

        const platformConfig: Record<string, { prefix: string; ext: string; findEntry: (e: { entryName: string }) => boolean }> = {
          "android-apk": {
            prefix: "app-debug", ext: ".apk",
            findEntry: (e) =>
              (e.entryName.includes('android/app/build/outputs/apk/normal/debug/') ||
               e.entryName.includes('android/app/build/outputs/apk/normal/release/')) &&
              e.entryName.endsWith('.apk'),
          },
          "ios-ipa": {
            prefix: "ipa-release", ext: ".ipa",
            findEntry: (e) => e.entryName.endsWith('.ipa'),
          },
          "harmonyos-hap": {
            prefix: "hap-release", ext: ".hap",
            findEntry: (e) => e.entryName.endsWith('.hap'),
          },
        };

        const config = platformConfig[build.platform];
        if (!config) continue;

        const artifactName = `${config.prefix}-${build.id}`;
        const artifactBuffer = await downloadGitHubArtifact(build.github_run_id, artifactName, build.platform);

        if (!artifactBuffer) {
          console.error(`[International AutoSync] Download failed for ${build.id}`);
          continue;
        }

        // Extract file from zip
        const zip = new AdmZip(artifactBuffer);
        const fileEntry = zip.getEntries().find(entry => config.findEntry(entry));

        if (!fileEntry) {
          console.error(`[International AutoSync] ${config.ext} not found in zip`);
          continue;
        }

        const fileBuffer = fileEntry.getData();
        const fileName = `builds/${build.id}/${config.prefix}${config.ext}`;
        console.log(`[International AutoSync] Uploading ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB...`);

        // Upload to Supabase storage
        await supabase.storage.from("user-builds").upload(fileName, fileBuffer, {
          contentType: "application/octet-stream",
          upsert: true,
        });

        // Update build record
        await supabase.from("builds").update({
          status: "completed",
          progress: 100,
          output_file_path: fileName,
          updated_at: new Date().toISOString(),
        }).eq("id", build.id);

        console.log(`[International AutoSync] Build ${build.id} synced successfully`);
        completedBuilds.set(build.id, Date.now());

      } else if (status.status === "completed" && status.conclusion === "failure") {
        await supabase.from("builds").update({
          status: "failed",
          progress: 100,
          error_message: "GitHub Actions build failed",
          updated_at: new Date().toISOString(),
        }).eq("id", build.id);

        completedBuilds.set(build.id, Date.now());
      }
    } catch (error) {
      console.error(`[International AutoSync] Error for ${build.id}:`, error instanceof Error ? error.message : String(error));
    } finally {
      syncingBuilds.delete(build.id);
    }
  }
}
