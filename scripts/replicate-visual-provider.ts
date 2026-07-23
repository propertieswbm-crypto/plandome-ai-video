import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SceneCategory } from "./universal-visual-planner";

export interface ReplicateVisualConfig {
  enabled: boolean;
  token: string;
  imageModel: string;
  videoModel: string;
  outputDirectory: string;
  timeoutMs: number;
  maxAttempts: number;
  requireVideo: boolean;
  allowImageFallback: boolean;
}

export interface ReplicateVisualRequest {
  sceneId: string;
  sceneIndex: number;
  totalScenes: number;
  category: SceneCategory;
  prompt: string;
  negativePrompt: string;
  fullScript?: string;
  seed: number;
  durationSeconds: number;
}

export interface ReplicateVisualResult {
  success: boolean;
  sceneId: string;
  kind?: "video" | "image";
  outputPath?: string;
  imagePath?: string;
  imageUrl?: string;
  videoUrl?: string;
  attempts: number;
  error?: string;
}

interface ReplicatePrediction {
  id?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
  urls?: {
    get?: string;
    cancel?: string;
  };
}

const SHOT_DIRECTIONS = [
  "slow cinematic dolly towards the main subject",
  "controlled architectural tracking shot from left to right",
  "subtle crane movement revealing the complete property",
  "premium street-level push-in with realistic parallax",
  "measured over-the-shoulder professional inspection shot",
  "close architectural detail followed by a wider contextual reveal",
  "restrained orbit around the subject while preserving geometry",
  "smooth lateral movement with foreground depth",
  "slow pull-back revealing the wider UK environment",
  "stable documentary-style property assessment shot",
  "premium low-angle architectural reveal",
  "gentle forward camera movement with realistic depth of field"
] as const;

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function envNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(minimum, Math.min(maximum, parsed));
}

function safeSeed(value: number): number {
  const normalized = Math.abs(Math.trunc(value)) % 2_147_483_646;
  return normalized + 1;
}

function safeFileName(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scene";
}

function modelPredictionUrl(model: string): string {
  const parts = model.split("/").filter(Boolean);

  if (parts.length !== 2) {
    throw new Error(`Invalid Replicate model identifier: ${model}`);
  }

  return `https://api.replicate.com/v1/models/${encodeURIComponent(
    parts[0]
  )}/${encodeURIComponent(parts[1])}/predictions`;
}

function outputUrlFromValue(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = outputUrlFromValue(item);
      if (result) return result;
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["url", "uri", "output", "file"]) {
      const result = outputUrlFromValue(record[key]);
      if (result) return result;
    }

    for (const item of Object.values(record)) {
      const result = outputUrlFromValue(item);
      if (result) return result;
    }
  }

  return undefined;
}

export function extractReplicateOutputUrl(value: unknown): string {
  const result = outputUrlFromValue(value);

  if (!result) {
    throw new Error("Replicate completed without returning a media URL.");
  }

  return result;
}

export function getReplicateVisualConfig(): ReplicateVisualConfig {
  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();

  return {
    enabled:
      Boolean(token) &&
      envBoolean(process.env.REPLICATE_VISUALS_ENABLED, true),
    token,
    imageModel:
      process.env.REPLICATE_IMAGE_MODEL ||
      "black-forest-labs/flux-1.1-pro",
    videoModel:
      process.env.REPLICATE_VIDEO_MODEL ||
      "bytedance/seedance-1-lite",
    outputDirectory:
      process.env.REPLICATE_OUTPUT_DIR ||
      path.resolve("assets", "generated-visuals"),
    timeoutMs: envNumber(
      process.env.REPLICATE_TIMEOUT_MS,
      900_000,
      60_000,
      1_800_000
    ),
    maxAttempts: Math.round(
      envNumber(process.env.REPLICATE_MAX_ATTEMPTS, 2, 1, 3)
    ),
    requireVideo: envBoolean(
      process.env.REPLICATE_VIDEO_REQUIRED,
      true
    ),
    allowImageFallback: envBoolean(
      process.env.REPLICATE_ALLOW_IMAGE_FALLBACK,
      false
    )
  };
}

export function buildReplicateImagePrompt(
  request: ReplicateVisualRequest
): string {
  const shot =
    SHOT_DIRECTIONS[
      Math.abs(request.sceneIndex) % SHOT_DIRECTIONS.length
    ];

  const context = String(request.fullScript || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return [
    "Create a photorealistic vertical 9:16 frame for a premium UK property and planning advertisement.",
    "The result must look like an expensive professionally filmed television commercial, not stock filler.",
    `Scene ${request.sceneIndex + 1} of ${request.totalScenes}.`,
    `Scene category: ${request.category}.`,
    `Required composition: ${shot}.`,
    request.prompt,
    context ? `Campaign context: ${context}.` : "",
    "Use authentic United Kingdom architecture, streets, construction materials, planning environments and professional details.",
    "Use physically accurate scale, straight walls, consistent windows, correct roof geometry and believable construction.",
    "Use natural cinematic lighting, realistic shadows, premium lens depth and restrained commercial colour grading.",
    "Compose one unmistakable hero subject with foreground, middle ground and background separation.",
    "Leave clean negative space for branding and headlines added later during composition.",
    "Do not generate writing, captions, signage, logos, watermarks, interface text or presentation graphics.",
    `Avoid: ${request.negativePrompt}.`,
    "No cartoon, no illustration, no vector art, no 3D icon, no toy building, no fake plastic CGI and no surreal architecture."
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildReplicateMotionPrompt(
  request: ReplicateVisualRequest
): string {
  const shot =
    SHOT_DIRECTIONS[
      Math.abs(request.sceneIndex) % SHOT_DIRECTIONS.length
    ];

  return [
    "Animate this exact photographic frame as a premium cinematic property advertisement.",
    `Camera direction: ${shot}.`,
    "Preserve the exact building, room, objects, materials, people and original composition.",
    "Use slow controlled professional camera movement with natural environmental motion.",
    "Maintain straight architecture, stable windows, stable roof lines and physically accurate perspective.",
    "People, vehicles, trees, paperwork and equipment may move only in subtle believable ways.",
    "Do not change the property design or invent additional doors, windows, floors, signs or structures.",
    "No morphing, melting, flicker, warping, duplicated objects, rapid zoom, handheld shake, jump cuts or surreal movement.",
    "No text, captions, logos or watermarks."
  ].join(" ");
}

async function responseError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");

  return body
    ? `HTTP ${response.status}: ${body.slice(0, 1000)}`
    : `HTTP ${response.status}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runPrediction(
  model: string,
  input: Record<string, unknown>,
  config: ReplicateVisualConfig
): Promise<ReplicatePrediction> {
  const response = await fetchWithTimeout(
    modelPredictionUrl(model),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        prefer: "wait=60",
        "cancel-after": "15m"
      },
      body: JSON.stringify({ input })
    },
    70_000
  );

  if (!response.ok) {
    throw new Error(
      `Replicate ${model} request failed: ${await responseError(
        response
      )}`
    );
  }

  let prediction = (await response.json()) as ReplicatePrediction;
  const startedAt = Date.now();

  while (
    prediction.status === "starting" ||
    prediction.status === "processing"
  ) {
    if (Date.now() - startedAt > config.timeoutMs) {
      throw new Error(`Replicate ${model} generation timed out.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const getUrl =
      prediction.urls?.get ||
      (prediction.id
        ? `https://api.replicate.com/v1/predictions/${prediction.id}`
        : "");

    if (!getUrl) {
      throw new Error(
        `Replicate ${model} did not provide a prediction status URL.`
      );
    }

    const pollResponse = await fetchWithTimeout(
      getUrl,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json"
        }
      },
      30_000
    );

    if (!pollResponse.ok) {
      throw new Error(
        `Replicate ${model} polling failed: ${await responseError(
          pollResponse
        )}`
      );
    }

    prediction =
      (await pollResponse.json()) as ReplicatePrediction;
  }

  if (prediction.status !== "succeeded") {
    const detail =
      typeof prediction.error === "string"
        ? prediction.error
        : JSON.stringify(prediction.error || "Unknown failure");

    throw new Error(
      `Replicate ${model} failed with status ${
        prediction.status || "unknown"
      }: ${detail}`
    );
  }

  return prediction;
}

async function downloadMedia(
  url: string,
  destination: string,
  minimumBytes: number
): Promise<void> {
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET"
    },
    180_000
  );

  if (!response.ok) {
    throw new Error(
      `Generated media download failed: ${await responseError(
        response
      )}`
    );
  }

  const data = Buffer.from(await response.arrayBuffer());

  if (data.length < minimumBytes) {
    throw new Error(
      `Generated media was too small: ${data.length} bytes.`
    );
  }

  await writeFile(destination, data);

  const file = await stat(destination);

  if (file.size < minimumBytes) {
    throw new Error(
      `Generated media file was invalid: ${destination}`
    );
  }
}

export async function generateReplicateSceneVisual(
  request: ReplicateVisualRequest,
  config = getReplicateVisualConfig()
): Promise<ReplicateVisualResult> {
  if (!config.enabled) {
    return {
      success: false,
      sceneId: request.sceneId,
      attempts: 0,
      error:
        "Replicate visuals are unavailable because REPLICATE_API_TOKEN is not configured."
    };
  }

  await mkdir(config.outputDirectory, {
    recursive: true
  });

  const baseName = safeFileName(request.sceneId);
  let lastError = "Unknown Replicate generation failure.";

  for (
    let attempt = 1;
    attempt <= config.maxAttempts;
    attempt += 1
  ) {
    const seed = safeSeed(request.seed + attempt * 104_729);

    try {
      const imagePrediction = await runPrediction(
        config.imageModel,
        {
          prompt: buildReplicateImagePrompt({
            ...request,
            seed
          }),
          aspect_ratio: "9:16",
          output_format: "jpg",
          output_quality: 95,
          safety_tolerance: 2,
          prompt_upsampling: true,
          seed
        },
        config
      );

      const imageUrl = extractReplicateOutputUrl(
        imagePrediction.output
      );

      const imagePath = path.join(
        config.outputDirectory,
        `${baseName}-${seed}.jpg`
      );

      await downloadMedia(imageUrl, imagePath, 50_000);

      const duration = Math.max(
        5,
        Math.min(12, Math.ceil(request.durationSeconds))
      );

      try {
        const videoPrediction = await runPrediction(
          config.videoModel,
          {
            image: imageUrl,
            prompt: buildReplicateMotionPrompt({
              ...request,
              seed
            }),
            duration,
            resolution: "720p",
            fps: 24,
            camera_fixed: false,
            seed
          },
          config
        );

        const videoUrl = extractReplicateOutputUrl(
          videoPrediction.output
        );

        const videoPath = path.join(
          config.outputDirectory,
          `${baseName}-${seed}.mp4`
        );

        await downloadMedia(videoUrl, videoPath, 150_000);

        return {
          success: true,
          sceneId: request.sceneId,
          kind: "video",
          outputPath: videoPath,
          imagePath,
          imageUrl,
          videoUrl,
          attempts: attempt
        };
      } catch (videoError) {
        if (
          !config.requireVideo &&
          config.allowImageFallback
        ) {
          return {
            success: true,
            sceneId: request.sceneId,
            kind: "image",
            outputPath: imagePath,
            imagePath,
            imageUrl,
            attempts: attempt,
            error:
              videoError instanceof Error
                ? videoError.message
                : "Image-to-video generation failed."
          };
        }

        throw videoError;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Unknown Replicate generation error.";

      if (attempt < config.maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2500 * attempt)
        );
      }
    }
  }

  return {
    success: false,
    sceneId: request.sceneId,
    attempts: config.maxAttempts,
    error: lastError
  };
}
