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
import {
  generateNoApiCinematicVisual,
  getNoApiVisualConfig
} from "./no-api-cinematic-provider";

export interface ResolvedSceneVisual {
  sceneId: string;
  success: boolean;
  mode: VisualMode;
  assetPath?: string;
  source:
    | "no_api_commons"
    | "replicate"
    | "comfyui"
    | "local_video"
    | "local_image"
    | "brand_cta"
    | "none";
  attempts: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolvePremiumVisualOptions {
  sceneIndex?: number;
  totalScenes?: number;
  fullScript?: string;
  usedAssetPaths?: Set<string>;
  usedSourceUrls?: Set<string>;
}

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".m4v"
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

function envBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (!value || value.trim() === "") return fallback;

  return value.trim().toLowerCase() === "true";
}

function categoryFolder(category: SceneCategory): string {
  return category.replace(/_/g, "-");
}

async function listMediaFiles(
  directory: string,
  extensions: Set<string>
): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, {
      withFileTypes: true
    });

    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          extensions.has(
            path.extname(entry.name).toLowerCase()
          )
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

function unusedCandidates(
  candidates: string[],
  usedAssetPaths?: Set<string>
): string[] {
  if (!usedAssetPaths) return candidates;

  return candidates.filter(
    (candidate) =>
      !usedAssetPaths.has(path.resolve(candidate))
  );
}

export async function findRealisticLocalFallback(
  scene: SceneVisualPlan,
  libraryRoot = path.resolve("assets", "visual-library"),
  usedAssetPaths?: Set<string>
): Promise<{
  video?: string;
  image?: string;
}> {
  const category = categoryFolder(
    scene.fallbackCategory || scene.category
  );

  const allowGeneric = envBoolean(
    process.env.ALLOW_GENERIC_VISUAL_FALLBACK,
    false
  );

  const videoDirectories = [
    path.join(libraryRoot, "videos", category),
    ...(allowGeneric
      ? [path.join(libraryRoot, "videos", "generic-real-world")]
      : [])
  ];

  const imageDirectories = [
    path.join(libraryRoot, "images", category),
    ...(allowGeneric
      ? [path.join(libraryRoot, "images", "generic-real-world")]
      : [])
  ];

  const videos = unusedCandidates(
    (
      await Promise.all(
        videoDirectories.map((directory) =>
          listMediaFiles(directory, VIDEO_EXTENSIONS)
        )
      )
    ).flat(),
    usedAssetPaths
  );

  const images = unusedCandidates(
    (
      await Promise.all(
        imageDirectories.map((directory) =>
          listMediaFiles(directory, IMAGE_EXTENSIONS)
        )
      )
    ).flat(),
    usedAssetPaths
  );

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

function providerOrder(): Array<"no_api" | "comfyui"> {
  const provider = String(
    process.env.AI_VISUAL_PROVIDER || "no_api"
  )
    .trim()
    .toLowerCase();

  return provider === "comfyui"
    ? ["comfyui", "no_api"]
    : ["no_api", "comfyui"];
}

export async function resolvePremiumSceneVisual(
  originalScene: SceneVisualPlan,
  options: ResolvePremiumVisualOptions = {}
): Promise<ResolvedSceneVisual> {
  const scene = upgradeSceneForPremiumAd(originalScene);
  const noApiConfig = getNoApiVisualConfig();
  const comfyConfig = getComfyUIConfig();

  let lastError = "";

  for (const provider of providerOrder()) {
    if (
      provider === "no_api" &&
      noApiConfig.enabled &&
      scene.category !== "brand_cta"
    ) {
      const generated =
        await generateNoApiCinematicVisual(
          {
            sceneId: scene.sceneId,
            sceneIndex: options.sceneIndex || 0,
            totalScenes: options.totalScenes || 1,
            category: scene.category,
            subject: scene.subject,
            environment: scene.environment,
            action: scene.action,
            fullScript: options.fullScript,
            durationSeconds: scene.durationSeconds,
            usedSourceUrls: options.usedSourceUrls
          },
          noApiConfig
        );

      if (generated.success && generated.outputPath) {
        const resolvedPath = path.resolve(
          generated.outputPath
        );

        if (
          !options.usedAssetPaths ||
          !options.usedAssetPaths.has(resolvedPath)
        ) {
          options.usedAssetPaths?.add(resolvedPath);

          return {
            sceneId: scene.sceneId,
            success: true,
            mode: "local_video",
            assetPath: resolvedPath,
            source: "no_api_commons",
            attempts: generated.attempts,
            metadata: {
              sourceUrl: generated.sourceUrl,
              sourceTitle: generated.sourceTitle,
              license: generated.license,
              artist: generated.artist,
              query: generated.query
            }
          };
        }

        lastError =
          "A generated clip duplicated another scene asset.";
      } else {
        lastError =
          generated.error ||
          "No-key cinematic media generation failed.";
      }
    }

    if (
      provider === "comfyui" &&
      comfyConfig.enabled &&
      scene.category !== "brand_cta"
    ) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const retry = createRetryAttempt(
          scene,
          attempt,
          lastError
        );

        const generated = await generateWithComfyUI(
          {
            sceneId: scene.sceneId,
            prompt: retry.prompt,
            negativePrompt: retry.negativePrompt,
            mode: "video",
            seed: retry.seed || Date.now(),
            width: 720,
            height: 1280,
            durationSeconds: scene.durationSeconds
          },
          {
            ...comfyConfig,
            maxRetries: 1
          }
        );

        if (
          generated.success &&
          generated.outputPath
        ) {
          const resolvedPath = path.resolve(
            generated.outputPath
          );

          if (
            !options.usedAssetPaths ||
            !options.usedAssetPaths.has(resolvedPath)
          ) {
            options.usedAssetPaths?.add(resolvedPath);

            return {
              sceneId: scene.sceneId,
              success: true,
              mode: "ai_video",
              assetPath: resolvedPath,
              source: "comfyui",
              attempts: attempt
            };
          }
        }

        lastError =
          generated.error ||
          "ComfyUI generation failed.";
      }
    }
  }

  if (
    envBoolean(
      process.env.ALLOW_LOCAL_VISUAL_FALLBACK,
      false
    )
  ) {
    const local = await findRealisticLocalFallback(
      scene,
      path.resolve("assets", "visual-library"),
      options.usedAssetPaths
    );

    const fallback = selectNoErrorFallback(
      scene,
      local.video,
      local.image
    );

    if (fallback.allowRender && fallback.assetPath) {
      const resolvedPath = path.resolve(
        fallback.assetPath
      );

      options.usedAssetPaths?.add(resolvedPath);

      return {
        sceneId: scene.sceneId,
        success: true,
        mode: fallback.mode,
        assetPath: resolvedPath,
        source:
          fallback.mode === "local_video"
            ? "local_video"
            : "local_image",
        attempts: 0,
        error: lastError || undefined
      };
    }
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
    mode: "local_video",
    source: "none",
    attempts: 0,
    error:
      lastError ||
      "No unique licensed cinematic media was available."
  };
}

export async function resolveAllPremiumVisuals(
  scenes: SceneVisualPlan[],
  fullScript = ""
): Promise<ResolvedSceneVisual[]> {
  const results: ResolvedSceneVisual[] = [];
  const usedAssetPaths = new Set<string>();
  const usedSourceUrls = new Set<string>();

  for (let index = 0; index < scenes.length; index += 1) {
    results.push(
      await resolvePremiumSceneVisual(scenes[index], {
        sceneIndex: index,
        totalScenes: scenes.length,
        fullScript,
        usedAssetPaths,
        usedSourceUrls
      })
    );
  }

  return results;
}
