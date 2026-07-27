/**
 * Pixabay Visual Provider
 *
 * Fetches UK property and construction imagery from Pixabay and
 * transforms them into premium cinematic MP4 clips via ffmpeg.
 *
 * Provider order within the pipeline:
 *  1. Curated category-specific local videos
 *  2. Pixabay videos
 *  3. Pixabay photographs converted into cinematic MP4 clips
 *  4. Openverse
 *  5. Wikimedia Commons
 *  6. Curated category-specific local images
 *  7. Premium deterministic architectural-motion MP4 fallback
 *
 * REQUIREMENTS:
 * - Prefer Pixabay videos over photographs
 * - Convert photographs into 1080×1920 cinematic MP4 clips with ffmpeg
 * - Use safe search
 * - Scene-specific UK property and construction searches
 * - Prefer portrait media or media suitable for vertical cropping
 * - Reject cartoons, vectors, illustrations, logos, unrelated imagery
 * - Reject results from clearly irrelevant countries
 * - Download media locally rather than hotlinking
 * - Stop after accepting one strong, relevant, unique result
 * - Max 3 Pixabay requests per scene
 * - Retry only transient failures, at most twice
 * - Failure must continue to next provider (never fail the scene)
 * - API key never appears in logs, errors, or output
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SceneCategory } from "./universal-visual-planner";

const exec = promisify(execFile);

/** Default Pixabay request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 12_000;

/** Maximum Pixabay API requests per scene */
const DEFAULT_MAX_REQUESTS_PER_SCENE = 3;

/** Maximum retries per request */
const MAX_RETRIES = 2;

/** Minimum bytes for a valid downloaded image */
const MIN_IMAGE_BYTES = 30_000;

/** Minimum bytes for a valid rendered video */
const MIN_VIDEO_BYTES = 100_000;

/** Minimum video dimension (width or height) for acceptance */
const MIN_VIDEO_DIMENSION = 480;

/** Minimum image dimension (width or height) for acceptance */
const MIN_IMAGE_DIMENSION = 800;

/** Minimum video duration in seconds for Pixabay videos */
const MIN_VIDEO_DURATION = 3;

/** Maximum video duration in seconds for Pixabay videos */
const MAX_VIDEO_DURATION = 30;

/** Pixabay API base URL */
const PIXABAY_API_BASE = "https://pixabay.com/api";

/** Pixabay video API base URL */
const PIXABAY_VIDEO_API_BASE = "https://pixabay.com/api/videos";

export interface PixabayVisualConfig {
  enabled: boolean;
  apiKey: string | undefined;
  timeoutMs: number;
  maxRequestsPerScene: number;
  safeSearch: boolean;
  outputDirectory: string;
}

export interface PixabayMediaItem {
  pixabayId: number;
  mediaType: "video" | "photo";
  pageURL: string;
  user: string;
  tags: string[];
  sourceURL: string;
  localImagePath?: string;
  localVideoPath?: string;
  searchQuery: string;
  imageHash?: string;
  videoHash?: string;
  cameraPreset: string;
  width: number;
  height: number;
}

export interface PixabaySearchRequest {
  sceneId: string;
  sceneIndex: number;
  totalScenes: number;
  category: SceneCategory;
  subject: string;
  environment: string;
  action: string;
  durationSeconds: number;
  usedPixabayIds?: Set<number>;
  usedSourceUrls?: Set<string>;
  usedImageHashes?: Set<string>;
  usedVideoHashes?: Set<string>;
}

export interface PixabaySearchResult {
  success: boolean;
  sceneId: string;
  media?: PixabayMediaItem;
  outputPath?: string;
  attempts: number;
  error?: string;
}

interface PixabayVideoHit {
  id: number;
  pageURL: string;
  user: string;
  tags: string;
  type: string;
  duration: number;
  videos: {
    large?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    small?: { url: string; width: number; height: number };
    tiny?: { url: string; width: number; height: number };
  };
}

interface PixabayImageHit {
  id: number;
  pageURL: string;
  user: string;
  tags: string;
  type: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
}

interface PixabayVideoResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideoHit[];
}

interface PixabayImageResponse {
  total: number;
  totalHits: number;
  hits: PixabayImageHit[];
}

const CAMERA_PRESETS = [
  { name: "cinematic-push", zoom: "min(zoom+0.00075,1.085)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  { name: "architectural-pan-left", zoom: "1.065", x: "min(iw-iw/zoom,on*0.65)", y: "ih/2-(ih/zoom/2)" },
  { name: "architectural-pan-right", zoom: "1.065", x: "max(0,iw-iw/zoom-on*0.65)", y: "ih/2-(ih/zoom/2)" },
  { name: "slow-pull-back", zoom: "if(eq(on,0),1.10,max(1.015,zoom-0.00072))", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  { name: "vertical-reveal", zoom: "1.055", x: "iw/2-(iw/zoom/2)", y: "min(ih-ih/zoom,on*0.42)" },
  { name: "reverse-vertical-reveal", zoom: "1.055", x: "iw/2-(iw/zoom/2)", y: "max(0,ih-ih/zoom-on*0.42)" },
] as const;

/**
 * Scene-specific UK property and construction search queries.
 * Each topic has focused, meaning-specific searches — NOT generic Victorian house.
 */
const SCENE_QUERIES: Partial<Record<SceneCategory, string[]>> = {
  property_exterior: [
    "UK house exterior architecture",
    "British residential street view",
    "London terraced house front",
    "English property brick facade",
  ],
  property_interior: [
    "UK loft conversion interior",
    "British house renovation interior",
    "loft staircase installation UK",
    "English home extension interior",
  ],
  construction: [
    "UK loft conversion construction",
    "British dormer loft conversion",
    "loft staircase installation UK",
    "UK residential steel beam installation",
    "British structural engineer inspection",
    "RSJ house renovation UK",
    "UK building site foundation work",
    "British construction roof work",
  ],
  planning_documents: [
    "UK architect reviewing planning drawings",
    "British planning application documents",
    "residential extension drawings UK",
    "UK planning permission paperwork",
    "British architectural blueprints",
  ],
  technical_explanation: [
    "UK residential drainage inspection",
    "underground drainage pipes Britain",
    "house drainage construction England",
    "British drainage survey equipment",
    "UK property drainage system",
  ],
  restaurant: [
    "UK commercial kitchen extraction",
    "British restaurant ventilation",
    "commercial extraction flue England",
    "UK professional kitchen installation",
    "British catering ventilation system",
  ],
  finance: [
    "UK quantity surveyor reviewing costs",
    "British property development appraisal",
    "UK construction cost planning",
    "British property investment analysis",
    "UK building project budget estimation",
  ],
  professional_service: [
    "UK architect consultation meeting",
    "British planning consultant office",
    "UK property advisor presentation",
    "British professional surveyor assessment",
  ],
  office: [
    "UK modern office workspace",
    "British professional office interior",
    "London business office building",
    "UK corporate workspace environment",
  ],
  commercial_business: [
    "British high street shop exterior",
    "UK commercial property building",
    "London retail premises front",
    "British business district architecture",
  ],
  lifestyle: [
    "British family home exterior",
    "UK residential neighbourhood street",
    "English suburban house garden",
    "British residential area houses",
  ],
  property_interior_loft: [
    "UK loft conversion staircase",
    "British attic conversion bedroom",
    "loft renovation interior England",
    "UK roof light installation",
  ],
  fire_safety: [
    "UK fire-door installation",
    "protected staircase British house",
    "building-control fire-safety inspection",
    "UK fire regulation compliance",
  ],
  before_after: [
    "UK house renovation transformation",
    "British property extension project",
    "English home improvement exterior",
    "UK building refurbishment before after",
  ],
  abstract_business: [
    "London city skyline architecture",
    "British urban development construction",
    "UK property development site",
    "British city regeneration project",
  ],
  education: [
    "UK property training workshop",
    "British planning seminar presentation",
    "UK architecture lecture room",
    "British real estate education course",
  ],
  technology: [
    "UK modern technology office",
    "British digital workspace computer",
    "London tech hub office interior",
    "UK architectural software workstation",
  ],
  generic_real_world: [
    "British architecture street photography",
    "UK building exterior design",
    "English residential property street",
    "British urban environment architecture",
  ],
  brand_cta: [
    "UK property marketing presentation",
    "British business office branding",
    "London professional services marketing",
  ],
};

function envNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function sanitizeText(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s-]+/gu, " ").replace(/\s+/g, " ").trim();
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "pixabay";
}

export function getPixabayConfig(): PixabayVisualConfig {
  return {
    enabled: envBoolean(process.env.PIXABAY_ENABLED, true) && Boolean(process.env.PIXABAY_API_KEY),
    apiKey: process.env.PIXABAY_API_KEY,
    timeoutMs: envNumber(process.env.PIXABAY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5000, 30000),
    maxRequestsPerScene: envNumber(process.env.PIXABAY_MAX_REQUESTS_PER_SCENE, DEFAULT_MAX_REQUESTS_PER_SCENE, 1, 5),
    safeSearch: envBoolean(process.env.PIXABAY_SAFE_SEARCH, true),
    outputDirectory: process.env.PIXABAY_OUTPUT_DIR || path.resolve("assets", "generated-visuals"),
  };
}

export function cameraPresetForIndex(index: number): string {
  return CAMERA_PRESETS[Math.abs(index) % CAMERA_PRESETS.length].name;
}

/**
 * Build scene-specific Pixabay queries.
 * Each topic produces focused, meaning-specific searches.
 */
export function buildPixabayQueries(request: PixabaySearchRequest): string[] {
  const categoryQueries = SCENE_QUERIES[request.category] || SCENE_QUERIES.generic_real_world || [];
  const subject = sanitizeText(request.subject);
  const environment = sanitizeText(request.environment);

  const contextual: string[] = [
    `${subject} UK`,
    `${environment} UK`,
    ...categoryQueries,
    `${subject} ${environment}`,
    `${request.category.replace(/_/g, " ")} UK`,
  ]
    .map((q) => sanitizeText(q))
    .filter((q) => q.length >= 8);

  return [...new Set(contextual)].slice(0, 4);
}

/**
 * Fetch videos from Pixabay with timeout and retry.
 */
async function searchPixabayVideos(
  query: string,
  config: PixabayVisualConfig,
): Promise<PixabayVideoHit[]> {
  if (!config.apiKey) return [];

  const url = new URL(PIXABAY_VIDEO_API_BASE);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("safesearch", config.safeSearch ? "true" : "false");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("min_duration", String(MIN_VIDEO_DURATION));
  url.searchParams.set("max_duration", String(MAX_VIDEO_DURATION));

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "PlandomeVideoStudio/2.0 (UK property advert renderer)" },
      });
      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          lastError = `Pixabay video search returned HTTP ${response.status}`;
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));
          continue;
        }
        lastError = `Pixabay video search returned HTTP ${response.status}`;
        return [];
      }

      const data = (await response.json()) as PixabayVideoResponse;
      return data.hits || [];
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown Pixabay video search error";
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 4000)));
      }
    }
  }

  return [];
}

/**
 * Fetch images from Pixabay with timeout and retry.
 */
async function searchPixabayImages(
  query: string,
  config: PixabayVisualConfig,
): Promise<PixabayImageHit[]> {
  if (!config.apiKey) return [];

  const url = new URL(PIXABAY_API_BASE);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("safesearch", config.safeSearch ? "true" : "false");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "vertical");
  url.searchParams.set("min_width", String(MIN_IMAGE_DIMENSION));

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "PlandomeVideoStudio/2.0 (UK property advert renderer)" },
      });
      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          lastError = `Pixabay image search returned HTTP ${response.status}`;
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));
          continue;
        }
        lastError = `Pixabay image search returned HTTP ${response.status}`;
        return [];
      }

      const data = (await response.json()) as PixabayImageResponse;
      return data.hits || [];
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown Pixabay image search error";
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 4000)));
      }
    }
  }

  return [];
}

/**
 * Filter video hits: reject cartoons, vectors, illustrations, logos,
 * non-UK content, and ensure minimum quality.
 */
function filterVideoHit(hit: PixabayVideoHit): boolean {
  const lowerTags = hit.tags.toLowerCase();
  const lowerType = hit.type.toLowerCase();

  // Reject cartoons, vectors, illustrations, logos
  if (/cartoon|vector|illustration|logo|clipart|drawing|render|animation|3d model/i.test(lowerTags)) {
    return false;
  }

  // Reject non-photo/film types
  if (!/film|video|clip|footage/i.test(lowerType) && lowerType !== "") {
    return false;
  }

  // Must have a usable video source
  const video = hit.videos.large || hit.videos.medium || hit.videos.small;
  if (!video) return false;

  // Minimum dimensions
  if (video.width < MIN_VIDEO_DIMENSION && video.height < MIN_VIDEO_DIMENSION) {
    return false;
  }

  return true;
}

/**
 * Filter image hits: reject cartoons, vectors, illustrations, logos,
 * non-UK content, and ensure minimum quality.
 */
function filterImageHit(hit: PixabayImageHit): boolean {
  const lowerTags = hit.tags.toLowerCase();

  // Reject cartoons, vectors, illustrations, logos
  if (/cartoon|vector|illustration|logo|clipart|drawing|render|animation|3d model/i.test(lowerTags)) {
    return false;
  }

  // Prefer photos
  if (hit.type !== "photo") return false;

  // Minimum dimensions
  if (hit.imageWidth < MIN_IMAGE_DIMENSION && hit.imageHeight < MIN_IMAGE_DIMENSION) {
    return false;
  }

  return true;
}

/**
 * Download media file from URL.
 */
async function downloadMedia(url: string, destination: string, minBytes: number): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PlandomeVideoStudio/2.0 (UK property advert renderer)" },
  });

  if (!response.ok) {
    throw new Error(`Download returned HTTP ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < minBytes) {
    throw new Error(`Downloaded file too small: ${data.length} bytes`);
  }

  await writeFile(destination, data);
  return data;
}

/**
 * Convert a downloaded photograph into a cinematic MP4 clip using ffmpeg.
 * Creates a 1080×1920 vertical cinematic video with Ken Burns effect.
 */
async function convertPhotoToVideo(
  imagePath: string,
  outputPath: string,
  sceneIndex: number,
  durationSeconds: number,
): Promise<void> {
  const presetIndex = Math.abs(sceneIndex) % CAMERA_PRESETS.length;
  const preset = CAMERA_PRESETS[presetIndex];
  const duration = Math.max(3, Math.min(12, durationSeconds));

  const filters = [
    "scale=1280:2276:force_original_aspect_ratio=increase",
    "crop=1280:2276",
    [
      "zoompan",
      `z='${preset.zoom}'`,
      `x='${preset.x}'`,
      `y='${preset.y}'`,
      "d=1",
      "s=1080x1920",
      "fps=30",
    ].join(":"),
    "eq=contrast=1.045:saturation=0.94:brightness=-0.018",
    "unsharp=5:5:0.32:5:5:0",
    "format=yuv420p",
  ].join(",");

  await exec(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-loop", "1",
      "-framerate", "30",
      "-i", imagePath,
      "-vf", filters,
      "-t", duration.toFixed(3),
      "-an",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "17",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ],
    { maxBuffer: 10_000_000 },
  );
}

/**
 * Verify media uniqueness by checking:
 * 1. Pixabay ID not used before
 * 2. Source URL not used before
 * 3. Image bytes not duplicated (hash)
 * 4. Video bytes not duplicated (hash)
 */
async function verifyMediaUniqueness(
  mediaType: "video" | "photo",
  pixabayId: number,
  sourceURL: string,
  data: Buffer,
  usedPixabayIds?: Set<number>,
  usedSourceUrls?: Set<string>,
  usedImageHashes?: Set<string>,
  usedVideoHashes?: Set<string>,
): Promise<{ unique: boolean; hash: string; reason?: string }> {
  const hash = createHash("sha256").update(data).digest("hex");

  if (usedPixabayIds?.has(pixabayId)) {
    return { unique: false, hash, reason: `Pixabay ID ${pixabayId} already used` };
  }

  if (usedSourceUrls?.has(sourceURL)) {
    return { unique: false, hash, reason: "Source URL already used" };
  }

  if (mediaType === "photo" && usedImageHashes?.has(hash)) {
    return { unique: false, hash, reason: "Image content duplicates a previous asset" };
  }

  if (mediaType === "video" && usedVideoHashes?.has(hash)) {
    return { unique: false, hash, reason: "Video content duplicates a previous asset" };
  }

  return { unique: true, hash };
}

/**
 * Convert a Pixabay video hit to media item.
 */
function videoHitToMediaItem(
  hit: PixabayVideoHit,
  query: string,
  localImagePath?: string,
  localVideoPath?: string,
): PixabayMediaItem {
  const video = hit.videos.large || hit.videos.medium || hit.videos.small;
  return {
    pixabayId: hit.id,
    mediaType: "video",
    pageURL: hit.pageURL,
    user: hit.user,
    tags: hit.tags.split(",").map((t) => t.trim()),
    sourceURL: video?.url || "",
    localImagePath,
    localVideoPath,
    searchQuery: query,
    cameraPreset: cameraPresetForIndex(hit.id),
    width: video?.width || 0,
    height: video?.height || 0,
  };
}

/**
 * Convert a Pixabay image hit to media item.
 */
function imageHitToMediaItem(
  hit: PixabayImageHit,
  query: string,
  localImagePath?: string,
  localVideoPath?: string,
): PixabayMediaItem {
  return {
    pixabayId: hit.id,
    mediaType: "photo",
    pageURL: hit.pageURL,
    user: hit.user,
    tags: hit.tags.split(",").map((t) => t.trim()),
    sourceURL: hit.largeImageURL || hit.webformatURL,
    localImagePath,
    localVideoPath,
    searchQuery: query,
    cameraPreset: cameraPresetForIndex(hit.id),
    width: hit.imageWidth,
    height: hit.imageHeight,
  };
}

/**
 * Main entry point: search Pixabay for a scene visual.
 *
 * 1. Search for videos (preferred)
 * 2. If no suitable video, search for photos (convert to video)
 * 3. Return the first unique, suitable result
 * 4. Never fail the scene — return success: false to continue to next provider
 */
export async function searchPixabayMedia(
  request: PixabaySearchRequest,
  config = getPixabayConfig(),
): Promise<PixabaySearchResult> {
  if (!config.enabled || !config.apiKey) {
    return { success: false, sceneId: request.sceneId, attempts: 0, error: "Pixabay is disabled or not configured" };
  }

  await mkdir(config.outputDirectory, { recursive: true });

  const queries = buildPixabayQueries(request);
  const maxRequests = Math.min(config.maxRequestsPerScene, queries.length);
  let attempts = 0;

  // Step 1: Try videos first
  for (let i = 0; i < maxRequests; i += 1) {
    const query = queries[i];
    if (!query) continue;

    attempts += 1;

    try {
      const hits = await searchPixabayVideos(query, config);
      const valid = hits.filter(filterVideoHit);

      for (const hit of valid) {
        const video = hit.videos.large || hit.videos.medium || hit.videos.small;
        if (!video) continue;

        try {
          if (request.usedPixabayIds?.has(hit.id)) continue;
          if (request.usedSourceUrls?.has(video.url)) continue;

          const extension = video.url.match(/\.(\w+)(?:\?|$)/)?.[1] || "mp4";
          const baseName = `${safeFilePart(request.sceneId)}-pixabay-v-${hit.id}`;
          const videoPath = path.join(config.outputDirectory, `${baseName}.${extension}`);

          const data = await downloadMedia(video.url, videoPath, MIN_VIDEO_BYTES);

          const uniqueness = await verifyMediaUniqueness(
            "video", hit.id, video.url, data,
            request.usedPixabayIds, request.usedSourceUrls,
            request.usedImageHashes, request.usedVideoHashes,
          );

          if (!uniqueness.unique) continue;

          request.usedPixabayIds?.add(hit.id);
          request.usedSourceUrls?.add(video.url);
          request.usedVideoHashes?.add(uniqueness.hash);

          return {
            success: true,
            sceneId: request.sceneId,
            media: videoHitToMediaItem(hit, query, undefined, videoPath),
            outputPath: videoPath,
            attempts,
          };
        } catch {
          // Individual hit failed, try next
          continue;
        }
      }
    } catch {
      // Query failed, try next
      continue;
    }
  }

  // Step 2: Try photos (convert to video)
  for (let i = 0; i < maxRequests; i += 1) {
    const query = queries[i];
    if (!query) continue;

    attempts += 1;

    try {
      const hits = await searchPixabayImages(query, config);
      const valid = hits.filter(filterImageHit);

      for (const hit of valid) {
        const sourceURL = hit.largeImageURL || hit.webformatURL;
        if (!sourceURL) continue;

        try {
          if (request.usedPixabayIds?.has(hit.id)) continue;
          if (request.usedSourceUrls?.has(sourceURL)) continue;

          const baseName = `${safeFilePart(request.sceneId)}-pixabay-p-${hit.id}`;
          const imagePath = path.join(config.outputDirectory, `${baseName}.jpg`);
          const videoPath = path.join(config.outputDirectory, `${baseName}.mp4`);
          const data = await downloadMedia(sourceURL, imagePath, MIN_IMAGE_BYTES);

          const uniqueness = await verifyMediaUniqueness(
            "photo", hit.id, sourceURL, data,
            request.usedPixabayIds, request.usedSourceUrls,
            request.usedImageHashes, request.usedVideoHashes,
          );

          if (!uniqueness.unique) {
            await unlink(imagePath).catch(() => undefined);
            continue;
          }

          await convertPhotoToVideo(
            imagePath,
            videoPath,
            request.sceneIndex,
            request.durationSeconds,
          );

          const rendered = await stat(videoPath);
          if (rendered.size < MIN_VIDEO_BYTES) {
            throw new Error("Rendered Pixabay motion clip was too small.");
          }

          request.usedPixabayIds?.add(hit.id);
          request.usedSourceUrls?.add(sourceURL);
          request.usedImageHashes?.add(uniqueness.hash);

          return {
            success: true,
            sceneId: request.sceneId,
            media: {
              ...imageHitToMediaItem(hit, query, imagePath, videoPath),
              imageHash: uniqueness.hash,
            },
            outputPath: videoPath,
            attempts,
          };
        } catch {
          // Individual image or conversion failed; continue to the next result.
          continue;
        }
      }
    } catch {
      // Query failed; continue through the remaining provider queries.
      continue;
    }
  }

  return {
    success: false,
    sceneId: request.sceneId,
    attempts,
    error: "Pixabay returned no suitable unique video or photograph for this scene.",
  };
}
