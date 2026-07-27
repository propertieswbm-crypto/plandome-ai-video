/**
 * No-API Cinematic Visual Provider
 *
 * Fetches CC-licensed UK property imagery from Wikimedia Commons and
 * transforms them into premium cinematic MP4 clips via ffmpeg.
 *
 * PERFORMANCE OPTIMISATIONS:
 * - Max 5-8 focused queries per scene (from 18+)
 * - No fixed delays between successful requests
 * - Exponential backoff only on rate-limit/transient errors
 * - Max 3 concurrent searches
 * - Stops as soon as one suitable unique visual is found
 * - 10-second request timeout, max 2 retries
 * - In-memory search and media hash cache
 * - 45-second online search budget per scene
 * - After budget expiry, returns fallback signal for local library
 * - Final video never fails due to Wikimedia being slow/unavailable
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SceneCategory } from "./universal-visual-planner";

const exec = promisify(execFile);

/** Maximum online search budget per scene in milliseconds */
const SCENE_SEARCH_BUDGET_MS = 45_000; // 45 seconds

/** Number of concurrent Wikimedia searches to run */
const CONCURRENT_SEARCHES = 3;

/** Maximum retries per API request */
const MAX_RETRIES = 2;

/** Request timeout in milliseconds (short: 10s) */
const REQUEST_TIMEOUT_MS = 10_000;

/** Minimum bytes for a valid downloaded image */
const MIN_IMAGE_BYTES = 30_000;

/** Minimum bytes for a valid rendered video */
const MIN_VIDEO_BYTES = 100_000;

/**
 * In-memory cache for Wikimedia Commons search results and downloaded media hashes.
 * Prevents repeated network calls for the same query or scene topic within a session.
 */
class SearchCache {
  private results = new Map<string, CommonsPage[]>();
  private mediaHashes = new Set<string>();
  private downloadedTopics = new Set<string>();

  hasQuery(query: string): boolean {
    return this.results.has(query.trim().toLowerCase());
  }

  getQuery(query: string): CommonsPage[] | undefined {
    return this.results.get(query.trim().toLowerCase());
  }

  setQuery(query: string, pages: CommonsPage[]): void {
    this.results.set(query.trim().toLowerCase(), pages);
  }

  hasMediaHash(hash: string): boolean {
    return this.mediaHashes.has(hash);
  }

  addMediaHash(hash: string): void {
    this.mediaHashes.add(hash);
  }

  hasDownloadedTopic(topicKey: string): boolean {
    return this.downloadedTopics.has(topicKey);
  }

  markDownloadedTopic(topicKey: string): void {
    this.downloadedTopics.add(topicKey);
  }
}

const searchCache = new SearchCache();

/**
 * Tracks elapsed time for a scene's online search budget.
 * After the budget expires, the caller should fall back to local assets.
 */
class TimeBudget {
  private readonly startedAt: number;
  private readonly budgetMs: number;

  constructor(budgetMs: number) {
    this.startedAt = Date.now();
    this.budgetMs = budgetMs;
  }

  remaining(): number {
    return Math.max(0, this.budgetMs - (Date.now() - this.startedAt));
  }

  isExpired(): boolean {
    return this.remaining() <= 0;
  }

  elapsed(): number {
    return Date.now() - this.startedAt;
  }
}

export interface NoApiVisualConfig {
  enabled: boolean;
  outputDirectory: string;
  timeoutMs: number;
  maximumQueries: number;
  minimumImageBytes: number;
  minimumVideoBytes: number;
}

export interface NoApiVisualRequest {
  sceneId: string;
  sceneIndex: number;
  totalScenes: number;
  category: SceneCategory;
  subject: string;
  environment: string;
  action: string;
  fullScript: string | undefined;
  durationSeconds: number;
  usedSourceUrls: Set<string> | undefined;
  usedImageHashes: Set<string> | undefined;
}

export interface NoApiVisualResult {
  success: boolean;
  sceneId: string;
  outputPath?: string;
  imagePath?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  license?: string;
  artist?: string;
  query?: string;
  attempts: number;
  error?: string;
  /** true if the search budget was exhausted (caller should use local fallback) */
  budgetExhausted?: boolean;
}

interface CommonsImageInfo {
  url?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value?: string }>;
}

interface CommonsPage {
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

interface SelectedCommonsImage {
  title: string;
  url: string;
  downloadUrl: string;
  mime: string;
  license: string;
  artist: string;
  width: number;
  height: number;
}

/**
 * Reduced, focused category queries (5-8 per category).
 * Each query is carefully chosen to maximise relevant UK property results
 * while minimising redundant API calls.
 */
const CATEGORY_QUERIES: Record<SceneCategory, string[]> = {
  property_exterior: [
    "London architecture photography street view UK",
    "British residential street architecture photography",
    "UK property exterior photography house",
    "British Victorian terraced house exterior",
    "London house exterior brickwork UK",
    "United Kingdom property exterior architecture"
  ],
  property_interior: [
    "UK house interior design photography",
    "British home renovation interior project",
    "London residential interior photography",
    "UK property loft conversion interior",
    "British residential interior transformation",
    "Victorian home interior architecture UK"
  ],
  construction: [
    "UK construction site photography building",
    "British building renovation work construction",
    "London property development construction site",
    "United Kingdom structural inspection site",
    "British residential construction detail",
    "UK house foundation and roof work"
  ],
  architecture: [
    "British architecture photography building",
    "London building architecture exterior street",
    "UK architectural heritage buildings photography",
    "British architectural practice review",
    "United Kingdom planning drawing presentation",
    "London residential architecture survey"
  ],
  planning_documents: [
    "UK architectural drawings plans building",
    "British property planning permission documents",
    "London council planning documents architecture",
    "United Kingdom council permission paperwork",
    "British architectural planning documents",
    "planning application review documents"
  ],
  commercial_business: [
    "London commercial property photography building",
    "British high street shops buildings exterior",
    "UK business district architecture commercial",
    "United Kingdom shopfront architecture",
    "London retail property exterior",
    "UK professional services building"
  ],
  restaurant: [
    "London restaurant interior photography cafe",
    "British cafe shop interior commercial kitchen",
    "UK commercial kitchen equipment restaurant",
    "British commercial kitchen interior",
    "United Kingdom restaurant extraction system",
    "UK food service ventilation installation"
  ],
  office: [
    "London office interior photography workspace",
    "British business workspace design office",
    "UK professional services office building",
    "British professional office interior",
    "United Kingdom property consultancy office",
    "UK corporate architecture workspace"
  ],
  finance: [
    "London financial district architecture building",
    "UK business finance office photography",
    "British property investment photography city",
    "British quantity surveyor cost planning",
    "United Kingdom construction finance review",
    "UK property investment valuation"
  ],
  technology: [
    "London technology office workspace photography",
    "British modern office technology workspace",
    "UK digital workspace photography office",
    "British digital property platform workspace",
    "United Kingdom professional technology office",
    "UK architectural technology review"
  ],
  education: [
    "UK university architecture building photography",
    "British education training centre building",
    "London professional development space office",
    "United Kingdom technical seminar room",
    "British property training session",
    "UK planning consultancy presentation"
  ],
  professional_service: [
    "London professional services photography office",
    "British business consultation meeting office",
    "UK property consultant office building",
    "British planning consultant meeting",
    "United Kingdom architect client consultation",
    "London property advisor office"
  ],
  lifestyle: [
    "London residential street photography houses",
    "British suburban neighbourhood houses street",
    "UK family home garden exterior photography",
    "British family home exterior",
    "United Kingdom residential neighbourhood",
    "London suburban property street"
  ],
  abstract_business: [
    "London city architecture skyline photography",
    "British urban development photography city",
    "UK commercial city buildings architecture",
    "British commercial property cityscape",
    "United Kingdom business district architecture",
    "London development site environment"
  ],
  technical_explanation: [
    "UK building technical survey photography",
    "British construction inspection process site",
    "London property structural assessment building",
    "British building regulations inspection",
    "United Kingdom technical construction detail",
    "British property drainage inspection"
  ],
  before_after: [
    "UK house renovation photography property",
    "British property restoration project building",
    "London Victorian house renovation exterior",
    "British house renovation before and after",
    "United Kingdom rear extension project",
    "London home improvement transformation"
  ],
  brand_cta: [
    "British residential architecture photography",
    "London property marketing visual building",
    "UK property business branding office",
    "London professional services marketing photography"
  ],
  generic_real_world: [
    "London England architecture street photography",
    "British buildings houses photography UK",
    "UK city architecture buildings street",
    "Victorian residential facade London",
    "British residential architecture exterior",
    "United Kingdom property exterior photography"
  ]
};

const CAMERA_PRESETS = [
  { name: "cinematic-push", zoom: "min(zoom+0.00075,1.085)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  { name: "architectural-pan-left", zoom: "1.065", x: "min(iw-iw/zoom,on*0.65)", y: "ih/2-(ih/zoom/2)" },
  { name: "architectural-pan-right", zoom: "1.065", x: "max(0,iw-iw/zoom-on*0.65)", y: "ih/2-(ih/zoom/2)" },
  { name: "slow-pull-back", zoom: "if(eq(on,0),1.10,max(1.015,zoom-0.00072))", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  { name: "vertical-reveal", zoom: "1.055", x: "iw/2-(iw/zoom/2)", y: "min(ih-ih/zoom,on*0.42)" },
  { name: "reverse-vertical-reveal", zoom: "1.055", x: "iw/2-(iw/zoom/2)", y: "max(0,ih-ih/zoom-on*0.42)" },
] as const;

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function envNumber(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function sanitizeText(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s-]+/gu, " ").replace(/\s+/g, " ").trim();
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "scene";
}

function cleanHtml(value: string | undefined): string {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function isDocumentCategory(category: SceneCategory): boolean {
  return ["planning_documents", "technical_explanation", "finance", "technology"].includes(category);
}

export function getNoApiVisualConfig(): NoApiVisualConfig {
  const provider = String(process.env.AI_VISUAL_PROVIDER || "").toLowerCase();
  return {
    enabled: envBoolean(process.env.NO_API_VISUALS_ENABLED, true) || provider === "no_api" || provider === "commons",
    outputDirectory: process.env.NO_API_OUTPUT_DIR || process.env.COMMONS_OUTPUT_DIR || path.resolve("assets", "generated-visuals"),
    timeoutMs: REQUEST_TIMEOUT_MS,
    maximumQueries: Math.round(envNumber(process.env.NO_API_MAX_QUERIES, 8, 5, 10)),
    minimumImageBytes: MIN_IMAGE_BYTES,
    minimumVideoBytes: MIN_VIDEO_BYTES,
  };
}

export function cameraPresetForScene(sceneIndex: number): (typeof CAMERA_PRESETS)[number] {
  return CAMERA_PRESETS[Math.abs(sceneIndex) % CAMERA_PRESETS.length]!;
}

export function buildNoApiQueryTiers(request: NoApiVisualRequest): string[] {
  const categoryQueries = CATEGORY_QUERIES[request.category] || CATEGORY_QUERIES.generic_real_world;
  const subject = sanitizeText(request.subject);
  const environment = sanitizeText(request.environment);
  const action = sanitizeText(request.action);

  const contextual = [
    `${subject} United Kingdom`,
    `${subject} British architecture`,
    `${environment} professional UK property`,
    `${subject} ${action} UK`,
    ...categoryQueries.slice(0, 4),
    `${subject} ${request.category.replace(/_/g, " ")}`,
  ]
    .map((q) => sanitizeText(q))
    .filter((q) => q.length >= 12);

  return [...new Set(contextual)].slice(0, 8);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchCommons(query: string, timeoutMs: number): Promise<CommonsPage[]> {
  // Check cache first
  if (searchCache.hasQuery(query)) {
    return searchCache.getQuery(query)!;
  }

  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "50", // Reduced from 100
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1920",
    maxlag: "5",
    format: "json",
    origin: "*",
  }).toString();

  let lastError = "";
  const effectiveTimeout = Math.min(timeoutMs, REQUEST_TIMEOUT_MS);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          headers: { "user-agent": "PlandomeVideoStudio/2.0 (UK property advert renderer)" },
        },
        effectiveTimeout,
      );

      if (!response.ok) {
        // Only retry on rate-limit or server errors
        if (response.status === 429 || response.status >= 500) {
          lastError = `Wikimedia search returned HTTP ${response.status}.`;
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 4000)));
          continue;
        }
        throw new Error(`Wikimedia search returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
      const pages = Object.values(payload.query?.pages || {});

      // Cache results
      searchCache.setQuery(query, pages);
      return pages;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown Wikimedia search error.";
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 4000)));
      }
    }
  }

  throw new Error(lastError || "Wikimedia search failed after retries.");
}

function selectCandidates(
  pages: CommonsPage[],
  query: string,
  category: SceneCategory,
  usedSourceUrls: Set<string>,
): SelectedCommonsImage[] {
  const queryTokens = query.toLowerCase().split(/\W+/).filter((token) => token.length >= 4);
  const allowDocuments = isDocumentCategory(category);

  return pages
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || !info.mime) return [];

      const license = info.extmetadata?.LicenseShortName?.value || "";
      const title = page.title || "";
      const lowerTitle = title.toLowerCase();

      if (!/CC|Public domain/i.test(license)) return [];
      if (!["image/jpeg", "image/png"].includes(info.mime)) return [];
      if (Math.max(info.width || 0, info.height || 0) < 800) return [];
      if (usedSourceUrls.has(info.url)) return [];
      if (/united states|america|california|florida|texas|canada|australia/i.test(lowerTitle)) return [];

      if (!allowDocuments && /map|diagram|coat of arms|flag|logo|icon|drawing|floor plan|site plan|illustration|cartoon|render/i.test(lowerTitle)) {
        return [];
      }

      const artist = cleanHtml(info.extmetadata?.Artist?.value);

      return [{
        title,
        url: info.url,
        downloadUrl: info.url || info.thumburl || "",
        mime: info.mime,
        license,
        artist,
        width: info.width || 0,
        height: info.height || 0,
      }];
    })
    .sort((a, b) => {
      const score = (candidate: SelectedCommonsImage) => {
        const title = candidate.title.toLowerCase();
        const tokenScore = queryTokens.filter((token) => title.includes(token)).length * 5;
        const dimensionScore = Math.min(4, Math.max(candidate.width, candidate.height) / 1000);
        const ukScore = /uk|united kingdom|british|england|london|croydon|manchester|birmingham|leeds|scotland|wales|northern ireland/i.test(title) ? 6 : 0;
        return tokenScore + dimensionScore + ukScore;
      };
      return score(b) - score(a);
    });
}

async function downloadImage(
  candidate: SelectedCommonsImage,
  destination: string,
  config: NoApiVisualConfig,
): Promise<Buffer> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        candidate.downloadUrl,
        {
          headers: { "user-agent": "PlandomeVideoStudio/2.0 (UK property advert renderer)" },
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!response.ok) {
        lastStatus = response.status;
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 4000)));
          continue;
        }
        throw new Error(`Wikimedia image download returned HTTP ${response.status}.`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length < config.minimumImageBytes) {
        throw new Error(`Downloaded image was only ${data.length} bytes.`);
      }

      await writeFile(destination, data);
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("aborted")) {
        lastStatus = 0;
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error(
    `Wikimedia image download failed after ${MAX_RETRIES} attempts${lastStatus ? ` (last HTTP ${lastStatus})` : " (timeout)"}.`,
  );
}

async function createCinematicVideo(
  imagePath: string,
  outputPath: string,
  sceneIndex: number,
  durationSeconds: number,
): Promise<void> {
  const preset = cameraPresetForScene(sceneIndex);
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
 * Runs multiple Commons searches concurrently, returning results from the
 * first query that produces usable candidates.
 */
async function concurrentSearch(
  queries: string[],
  timeoutMs: number,
  category: SceneCategory,
  usedSourceUrls: Set<string>,
): Promise<{ candidates: SelectedCommonsImage[]; query: string } | null> {
  // Process queries in batches of CONCURRENT_SEARCHES
  for (let batchStart = 0; batchStart < queries.length; batchStart += CONCURRENT_SEARCHES) {
    const batch = queries.slice(batchStart, batchStart + CONCURRENT_SEARCHES);

    const results = await Promise.allSettled(
      batch.map(async (query) => {
        const pages = await searchCommons(query, timeoutMs);
        const candidates = selectCandidates(pages, query, category, usedSourceUrls);
        return { candidates, query };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.candidates.length > 0) {
        return result.value;
      }
    }
  }

  return null;
}

export async function generateNoApiCinematicVisual(
  request: NoApiVisualRequest,
  config = getNoApiVisualConfig(),
): Promise<NoApiVisualResult> {
  if (!config.enabled) {
    return { success: false, sceneId: request.sceneId, attempts: 0, error: "No-API visual generation is disabled." };
  }

  await mkdir(config.outputDirectory, { recursive: true });

  const usedSourceUrls = request.usedSourceUrls || new Set<string>();
  const queries = buildNoApiQueryTiers(request).slice(0, config.maximumQueries);
  const seed = stableHash(`${request.sceneId}:${request.sceneIndex}:${request.subject}`);
  const budget = new TimeBudget(SCENE_SEARCH_BUDGET_MS);

  // Check if this topic was already successfully downloaded in this session
  const topicKey = `${request.category}:${sanitizeText(request.subject)}`;
  if (searchCache.hasDownloadedTopic(topicKey)) {
    return {
      success: false,
      sceneId: request.sceneId,
      attempts: 0,
      error: "Topic already resolved in this session; using local fallback.",
      budgetExhausted: true,
    };
  }

  let attempts = 0;
  let lastError = "No suitable UK media was found.";

  // Step 1: Try concurrent Commons search
  const searchResult = await concurrentSearch(queries, config.timeoutMs, request.category, usedSourceUrls);

  if (searchResult && !budget.isExpired()) {
    const { candidates, query } = searchResult;
    attempts += queries.indexOf(query) >= 0 ? queries.indexOf(query) + 1 : 1;

    // Try candidates in seed-determined order
    for (let offset = 0; offset < Math.min(candidates.length, 8); offset++) {
      if (budget.isExpired()) break;

      const candidate = candidates[(seed + offset) % candidates.length];
      if (!candidate) continue;

      const sourceHash = createHash("sha1").update(candidate.url).digest("hex").slice(0, 10);
      const extension = candidate.mime === "image/png" ? ".png" : ".jpg";
      const baseName = `${safeFilePart(request.sceneId)}-${sourceHash}`;
      const imagePath = path.join(config.outputDirectory, `${baseName}${extension}`);
      const videoPath = path.join(config.outputDirectory, `${baseName}.mp4`);

      try {
        const imageBytes = await downloadImage(candidate, imagePath, config);

        const imageHash = createHash("sha256").update(imageBytes).digest("hex");
        if (request.usedImageHashes?.has(imageHash)) {
          lastError = "Downloaded image content duplicates a previous scene.";
          await unlink(imagePath).catch(() => undefined);
          continue;
        }

        if (budget.isExpired()) {
          await unlink(imagePath).catch(() => undefined);
          break;
        }

        await createCinematicVideo(imagePath, videoPath, request.sceneIndex, request.durationSeconds);

        const video = await stat(videoPath);
        if (video.size < config.minimumVideoBytes) {
          throw new Error(`Cinematic clip was only ${video.size} bytes.`);
        }

        request.usedImageHashes?.add(imageHash);
        searchCache.addMediaHash(imageHash);
        usedSourceUrls.add(candidate.url);
        searchCache.markDownloadedTopic(topicKey);

        return {
          success: true,
          sceneId: request.sceneId,
          outputPath: videoPath,
          imagePath,
          sourceUrl: candidate.url,
          sourceTitle: candidate.title,
          license: candidate.license,
          artist: candidate.artist,
          query,
          attempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Media conversion failed.";
        await unlink(imagePath).catch(() => undefined);
        await unlink(videoPath).catch(() => undefined);
      }
    }
  } else if (!searchResult) {
    attempts = queries.length;
    lastError = "No licensed photographic candidates were found via Wikimedia Commons.";
  }

  // Step 2: If online search failed or budget expired, signal fallback
  if (budget.isExpired()) {
    return {
      success: false,
      sceneId: request.sceneId,
      attempts,
      error: `Online search budget (${SCENE_SEARCH_BUDGET_MS / 1000}s) exhausted. Using local library fallback.`,
      budgetExhausted: true,
    };
  }

  return {
    success: false,
    sceneId: request.sceneId,
    attempts,
    error: lastError,
    budgetExhausted: false,
  };
}
