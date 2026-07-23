import fs from "node:fs/promises";
import path from "node:path";
import type {
  SceneCategory,
  SceneVisualPlan,
  VisualMode
} from "./universal-visual-planner";
import {
  createRetryAttempt,
  selectNoErrorFallback,
  upgradeSceneForPremiumAd
} from "./premium-visual-policy";
import {
  generateWithComfyUI,
  getComfyUIConfig
} from "./comfyui-client";

export interface ResolvedSceneVisual {
  sceneId: string;
  success: boolean;
  mode: VisualMode;
  assetPath?: string;
  source: "comfyui" | "local_video" | "local_image" | "brand_cta" | "none";
  attempts: number;
  error?: string;
}

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function categoryFolder(category: SceneCategory): string {
  return category.replace(/_/g, "-");
}

async function listMediaFiles(
  directory: string,
  extensions: Set<string>
): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          extensions.has(path.extname(entry.name).toLowerCase())
      )
      .map((entry) => path.resolve(directory, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function stableIndex(sceneId: string, length: number): number {
  let hash = 0;

  for (const character of sceneId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return length === 0 ? 0 : hash % length;
}

export async function findRealisticLocalFallback(
  scene: SceneVisualPlan,
  libraryRoot = path.resolve("assets", "visual-library")
): Promise<{ video?: string; image?: string }> {
  const category = categoryFolder(scene.fallbackCategory || scene.category);

  const videoDirectories = [
    path.join(libraryRoot, "videos", category),
    path.join(libraryRoot, "videos", "generic-real-world")
  ];

  const imageDirectories = [
    path.join(libraryRoot, "images", category),
    path.join(libraryRoot, "images", "generic-real-world")
  ];

  const videos = (
    await Promise.all(
      videoDirectories.map((directory) =>
        listMediaFiles(directory, VIDEO_EXTENSIONS)
      )
    )
  ).flat();

  const images = (
    await Promise.all(
      imageDirectories.map((directory) =>
        listMediaFiles(directory, IMAGE_EXTENSIONS)
      )
    )
  ).flat();

  return {
    video:
      videos.length > 0
        ? videos[stableIndex(scene.sceneId, videos.length)]
        : undefined,
    image:
      images.length > 0
        ? images[stableIndex(scene.sceneId, images.length)]
        : undefined
  };
}

export async function resolvePremiumSceneVisual(
  originalScene: SceneVisualPlan
): Promise<ResolvedSceneVisual> {
  const scene = upgradeSceneForPremiumAd(originalScene);
  const config = getComfyUIConfig();

  let lastError = "";

  if (
    config.enabled &&
    (scene.visualMode === "ai_image_motion" ||
      scene.visualMode === "ai_video")
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const retry = createRetryAttempt(scene, attempt, lastError);

      const generated = await generateWithComfyUI(
        {
          sceneId: scene.sceneId,
          prompt: retry.prompt,
          negativePrompt: retry.negativePrompt,
          mode: scene.visualMode === "ai_video" ? "video" : "image",
          seed: retry.seed || Date.now(),
          width: 1280,
          height: 720,
          durationSeconds: scene.durationSeconds
        },
        {
          ...config,
          maxRetries: 1
        }
      );

      if (generated.success && generated.outputPath) {
        return {
          sceneId: scene.sceneId,
          success: true,
          mode: scene.visualMode,
          assetPath: generated.outputPath,
          source: "comfyui",
          attempts: attempt
        };
      }

      lastError = generated.error || "AI visual generation failed.";
    }
  }

  const local = await findRealisticLocalFallback(scene);
  const fallback = selectNoErrorFallback(
    scene,
    local.video,
    local.image
  );

  if (fallback.allowRender && fallback.assetPath) {
    return {
      sceneId: scene.sceneId,
      success: true,
      mode: fallback.mode,
      assetPath: fallback.assetPath,
      source:
        fallback.mode === "local_video"
          ? "local_video"
          : "local_image",
      attempts: config.enabled ? 3 : 0,
      error: lastError || undefined
    };
  }

  if (scene.category === "brand_cta") {
    return {
      sceneId: scene.sceneId,
      success: true,
      mode: "typography",
      source: "brand_cta",
      attempts: 0
    };
  }

  return {
    sceneId: scene.sceneId,
    success: false,
    mode: fallback.mode,
    source: "none",
    attempts: config.enabled ? 3 : 0,
    error:
      lastError ||
      "No realistic AI output or local photographic fallback was available."
  };
}

export async function resolveAllPremiumVisuals(
  scenes: SceneVisualPlan[]
): Promise<ResolvedSceneVisual[]> {
  const results: ResolvedSceneVisual[] = [];

  for (const scene of scenes) {
    results.push(await resolvePremiumSceneVisual(scene));
  }

  return results;
}
