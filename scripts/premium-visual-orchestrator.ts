import fs from "node:fs/promises";
import path from "node:path";
import type {
  SceneCategory,
  SceneVisualPlan,
  VisualMode
} from "./universal-visual-planner";
import {
  createRetryAttempt,
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
import {
  getPixabayConfig,
  searchPixabayMedia
} from "./pixabay-visual-provider";

export interface ResolvedSceneVisual {
  sceneId: string;
  success: boolean;
  mode: VisualMode;
  assetPath?: string;
  source:
  | "pixabay"
  | "no_api_commons"
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
  usedImageHashes?: Set<string>;
  usedVideoHashes?: Set<string>;
  usedPixabayIds?: Set<number>;
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
  video: string | undefined;
  image: string | undefined;
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
    process.env.AI_VISUAL_PROVIDER || ""
  )
    .trim()
    .toLowerCase();

  const noApiPreferred =
    provider === "no_api" ||
    envBoolean(process.env.NO_API_VISUALS_ENABLED, false);

  if (provider === "comfyui") {
    return ["comfyui", "no_api"];
  }

  return noApiPreferred ? ["no_api"] : ["no_api", "comfyui"];
}

export async function resolvePremiumSceneVisual(
  originalScene: SceneVisualPlan,
  options: ResolvePremiumVisualOptions = {}
): Promise<ResolvedSceneVisual> {
  const scene = upgradeSceneForPremiumAd(originalScene);
  const noApiConfig = getNoApiVisualConfig();
  const comfyConfig = getComfyUIConfig();
  const pixabayConfig = getPixabayConfig();

  let lastError = "";

  // --- Phase 1: Prefer Pixabay's curated real video/photo catalogue. ---
  if (pixabayConfig.enabled && scene.category !== "brand_cta") {
    const pixabay = await searchPixabayMedia(
      {
        sceneId: scene.sceneId,
        sceneIndex: options.sceneIndex || 0,
        totalScenes: options.totalScenes || 1,
        category: scene.category,
        subject: scene.subject,
        environment: scene.environment,
        action: scene.action,
        durationSeconds: scene.durationSeconds,
        usedPixabayIds: options.usedPixabayIds,
        usedSourceUrls: options.usedSourceUrls,
        usedImageHashes: options.usedImageHashes,
        usedVideoHashes: options.usedVideoHashes,
      },
      pixabayConfig,
    );

    if (pixabay.success && pixabay.outputPath) {
      const resolvedPath = path.resolve(pixabay.outputPath);
      if (!options.usedAssetPaths || !options.usedAssetPaths.has(resolvedPath)) {
        options.usedAssetPaths?.add(resolvedPath);
        return {
          sceneId: scene.sceneId,
          success: true,
          mode: "local_video",
          assetPath: resolvedPath,
          source: "pixabay",
          attempts: pixabay.attempts,
          metadata: {
            sourceUrl: pixabay.media?.pageURL || pixabay.media?.sourceURL,
            sourceTitle: pixabay.media?.tags.join(", "),
            artist: pixabay.media?.user,
            query: pixabay.media?.searchQuery,
            mediaType: pixabay.media?.mediaType,
            pixabayId: pixabay.media?.pixabayId,
          },
        };
      }
    }
    lastError = pixabay.error || "Pixabay media resolution failed.";
  }

  // --- Phase 2: Try Wikimedia Commons and locally hosted ComfyUI. ---
  for (const provider of providerOrder()) {
    if (
      provider === "no_api" &&
      noApiConfig.enabled &&
      scene.category !== "brand_cta"
    ) {
      const generated = await generateNoApiCinematicVisual(
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
          usedSourceUrls: options.usedSourceUrls,
          usedImageHashes: options.usedImageHashes,
        },
        noApiConfig,
      );

      // If Commons succeeded, return the result immediately
      if (generated.success && generated.outputPath) {
        const resolvedPath = path.resolve(generated.outputPath);

        if (!options.usedAssetPaths || !options.usedAssetPaths.has(resolvedPath)) {
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
              query: generated.query,
            },
          };
        }

        lastError = "A generated clip duplicated another scene asset.";
      } else if (generated.budgetExhausted) {
        // Budget exhausted — skip straight to local fallback (don't try ComfyUI)
        lastError = generated.error || "Online search budget exhausted; using local fallback.";
        break;
      } else {
        lastError = generated.error || "No-key cinematic media generation failed.";
      }
    }

    if (
      provider === "comfyui" &&
      comfyConfig.enabled &&
      scene.category !== "brand_cta"
    ) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const retry = createRetryAttempt(scene, attempt, lastError);

        const generated = await generateWithComfyUI(
          {
            sceneId: scene.sceneId,
            prompt: retry.prompt,
            negativePrompt: retry.negativePrompt,
            mode: "video",
            seed: retry.seed || Date.now(),
            width: 720,
            height: 1280,
            durationSeconds: scene.durationSeconds,
          },
          { ...comfyConfig, maxRetries: 1 },
        );

        if (generated.success && generated.outputPath) {
          const resolvedPath = path.resolve(generated.outputPath);

          if (!options.usedAssetPaths || !options.usedAssetPaths.has(resolvedPath)) {
            options.usedAssetPaths?.add(resolvedPath);

            return {
              sceneId: scene.sceneId,
              success: true,
              mode: "ai_video",
              assetPath: resolvedPath,
              source: "comfyui",
              attempts: attempt,
            };
          }
        }

        lastError = generated.error || "ComfyUI generation failed.";
      }
    }
  }

  // --- Phase 3: Local fallback (uses curated library assets). ---
  const localFallback = await findRealisticLocalFallback(scene, undefined, options.usedAssetPaths);

  if (localFallback.video) {
    return {
      sceneId: scene.sceneId,
      success: true,
      mode: "local_video",
      assetPath: localFallback.video,
      source: "local_video",
      attempts: 1,
      metadata: {
        note: "Local library video fallback used (online search was slow or unavailable).",
        category: scene.fallbackCategory || scene.category,
      },
    };
  }

  if (localFallback.image) {
    options.usedAssetPaths?.add(path.resolve(localFallback.image));

    return {
      sceneId: scene.sceneId,
      success: true,
      mode: "local_image_motion",
      assetPath: localFallback.image,
      source: "local_image",
      attempts: 1,
      metadata: {
        note: "Local library image fallback used (online search was slow or unavailable).",
        category: scene.fallbackCategory || scene.category,
      },
    };
  }

  // --- Phase 4: Last-resort deterministic fallback (brand_cta or generic). ---
  if (scene.category === "brand_cta") {
    return {
      sceneId: scene.sceneId,
      success: true,
      mode: "typography",
      source: "brand_cta",
      attempts: 0,
    };
  }

  // Final fallback: return a clear error so the caller can decide
  return {
    sceneId: scene.sceneId,
    success: false,
    mode: "local_video",
    source: "none",
    attempts: 0,
    error: lastError || "No unique licensed cinematic media was available and no local fallback exists.",
  };
}

export async function resolveAllPremiumVisuals(
  scenes: SceneVisualPlan[],
  fullScript = ""
): Promise<ResolvedSceneVisual[]> {
  const results: ResolvedSceneVisual[] = [];
  const usedAssetPaths = new Set<string>();
  const usedSourceUrls = new Set<string>();
  const usedImageHashes = new Set<string>();
  const usedVideoHashes = new Set<string>();
  const usedPixabayIds = new Set<number>();

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (!scene) continue;

    results.push(
      await resolvePremiumSceneVisual(scene, {
        sceneIndex: index,
        totalScenes: scenes.length,
        fullScript,
        usedAssetPaths,
        usedSourceUrls,
        usedImageHashes,
        usedVideoHashes,
        usedPixabayIds
      })
    );
  }

  return results;
}
