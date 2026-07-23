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
  fullScript?: string;
  durationSeconds: number;
  usedSourceUrls?: Set<string>;
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
}

interface CommonsImageInfo {
  url?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<
    string,
    {
      value?: string;
    }
  >;
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

const CATEGORY_QUERIES: Record<SceneCategory, string[]> = {
  property_exterior: [
    "Victorian terraced house London",
    "British terraced house exterior",
    "United Kingdom residential street architecture",
    "Victorian house England"
  ],
  property_interior: [
    "British Victorian house interior",
    "United Kingdom residential interior",
    "London house interior architecture",
    "British home renovation interior"
  ],
  construction: [
    "United Kingdom house construction site",
    "British residential construction",
    "London building site house",
    "UK construction inspection"
  ],
  architecture: [
    "British architect building inspection",
    "United Kingdom architecture practice",
    "London architectural property survey",
    "British residential architecture"
  ],
  planning_documents: [
    "British architect reviewing plans",
    "United Kingdom architectural drawings office",
    "UK planning application drawings",
    "British planning documents architect"
  ],
  commercial_business: [
    "British high street shopfront",
    "United Kingdom commercial property",
    "London retail property exterior",
    "British commercial premises"
  ],
  restaurant: [
    "British restaurant interior",
    "United Kingdom commercial kitchen",
    "London hospitality interior",
    "British restaurant premises"
  ],
  office: [
    "British architecture office",
    "United Kingdom professional office meeting",
    "London property consultancy office",
    "British office interior"
  ],
  finance: [
    "British quantity surveyor plans",
    "United Kingdom property investment office",
    "British construction cost planning",
    "UK property finance professional"
  ],
  technology: [
    "British architecture technology office",
    "United Kingdom professional computer workspace",
    "UK property technology office",
    "British technical design studio"
  ],
  education: [
    "British architecture training",
    "United Kingdom professional seminar",
    "British property education",
    "UK technical presentation"
  ],
  professional_service: [
    "British architect client consultation",
    "United Kingdom property professional meeting",
    "British planning consultant office",
    "UK professional property advice"
  ],
  lifestyle: [
    "British family house exterior",
    "United Kingdom residential lifestyle",
    "London home exterior",
    "British property neighbourhood"
  ],
  abstract_business: [
    "British commercial property city",
    "United Kingdom business district architecture",
    "London property development",
    "British urban architecture"
  ],
  technical_explanation: [
    "British building survey inspection",
    "United Kingdom construction detail",
    "UK building control inspection",
    "British structural property survey"
  ],
  before_after: [
    "British house extension",
    "United Kingdom home renovation",
    "London rear extension house",
    "Victorian property renovation"
  ],
  brand_cta: [
    "British residential architecture",
    "London Victorian property"
  ],
  generic_real_world: [
    "Victorian terraced house London",
    "British residential architecture",
    "United Kingdom property exterior",
    "London residential street"
  ]
};

const CAMERA_PRESETS = [
  {
    name: "cinematic-push",
    zoom: "min(zoom+0.00075,1.085)",
    x: "iw/2-(iw/zoom/2)",
    y: "ih/2-(ih/zoom/2)"
  },
  {
    name: "architectural-pan-left",
    zoom: "1.065",
    x: "min(iw-iw/zoom,on*0.65)",
    y: "ih/2-(ih/zoom/2)"
  },
  {
    name: "architectural-pan-right",
    zoom: "1.065",
    x: "max(0,iw-iw/zoom-on*0.65)",
    y: "ih/2-(ih/zoom/2)"
  },
  {
    name: "slow-pull-back",
    zoom: "if(eq(on,0),1.10,max(1.015,zoom-0.00072))",
    x: "iw/2-(iw/zoom/2)",
    y: "ih/2-(ih/zoom/2)"
  },
  {
    name: "vertical-reveal",
    zoom: "1.055",
    x: "iw/2-(iw/zoom/2)",
    y: "min(ih-ih/zoom,on*0.42)"
  },
  {
    name: "reverse-vertical-reveal",
    zoom: "1.055",
    x: "iw/2-(iw/zoom/2)",
    y: "max(0,ih-ih/zoom-on*0.42)"
  }
] as const;

function envBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (!value || value.trim() === "") return fallback;

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

function sanitizeText(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return value
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scene";
}

function cleanHtml(value: string | undefined): string {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDocumentCategory(category: SceneCategory): boolean {
  return [
    "planning_documents",
    "technical_explanation",
    "finance",
    "technology"
  ].includes(category);
}

export function getNoApiVisualConfig(): NoApiVisualConfig {
  const provider = String(
    process.env.AI_VISUAL_PROVIDER || ""
  ).toLowerCase();

  return {
    enabled:
      envBoolean(process.env.NO_API_VISUALS_ENABLED, false) ||
      provider === "no_api" ||
      provider === "commons",
    outputDirectory:
      process.env.NO_API_OUTPUT_DIR ||
      process.env.COMMONS_OUTPUT_DIR ||
      path.resolve("assets", "generated-visuals"),
    timeoutMs: envNumber(
      process.env.NO_API_TIMEOUT_MS,
      180_000,
      30_000,
      600_000
    ),
    maximumQueries: Math.round(
      envNumber(process.env.NO_API_MAX_QUERIES, 8, 2, 12)
    ),
    minimumImageBytes: 50_000,
    minimumVideoBytes: 150_000
  };
}

export function cameraPresetForScene(sceneIndex: number) {
  return CAMERA_PRESETS[
    Math.abs(sceneIndex) % CAMERA_PRESETS.length
  ];
}

export function buildNoApiQueryTiers(
  request: NoApiVisualRequest
): string[] {
  const categoryQueries =
    CATEGORY_QUERIES[request.category] ||
    CATEGORY_QUERIES.generic_real_world;

  const subject = sanitizeText(request.subject);
  const environment = sanitizeText(request.environment);
  const action = sanitizeText(request.action);

  const contextual = [
    `${subject} United Kingdom`,
    `${environment} British architecture`,
    `${subject} ${action} UK`,
    ...categoryQueries,
    "Victorian terraced house London",
    "British residential architecture"
  ]
    .map((query) => sanitizeText(query))
    .filter((query) => query.length >= 8);

  return [...new Set(contextual)];
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

async function searchCommons(
  query: string,
  timeoutMs: number
): Promise<CommonsPage[]> {
  const url = new URL(
    "https://commons.wikimedia.org/w/api.php"
  );

  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1920",
    maxlag: "5",
    format: "json",
    origin: "*"
  }).toString();

  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          headers: {
            "user-agent":
              "PlandomeVideoStudio/2.0 (UK property advert renderer)"
          }
        },
        Math.min(timeoutMs, 30_000)
      );

      if (!response.ok) {
        throw new Error(
          `Wikimedia search returned HTTP ${response.status}.`
        );
      }

      const payload = (await response.json()) as {
        query?: {
          pages?: Record<string, CommonsPage>;
        };
      };

      return Object.values(
        payload.query?.pages || {}
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Unknown Wikimedia search error.";

      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1500)
        );
      }
    }
  }

  throw new Error(lastError);
}

function selectCandidates(
  pages: CommonsPage[],
  query: string,
  category: SceneCategory,
  usedSourceUrls: Set<string>
): SelectedCommonsImage[] {
  const queryTokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 4);

  const allowDocuments = isDocumentCategory(category);

  return pages
    .flatMap((page) => {
      const info = page.imageinfo?.[0];

      if (!info?.url || !info.mime) return [];

      const license =
        info.extmetadata?.LicenseShortName?.value || "";

      const title = page.title || "";
      const lowerTitle = title.toLowerCase();

      if (!/CC|Public domain/i.test(license)) return [];

      if (
        !["image/jpeg", "image/png"].includes(info.mime)
      ) {
        return [];
      }

      if (
        Math.max(info.width || 0, info.height || 0) < 1200
      ) {
        return [];
      }

      if (usedSourceUrls.has(info.url)) return [];

      if (
        /united states|america|california|florida|texas|canada|australia/i.test(
          lowerTitle
        )
      ) {
        return [];
      }

      if (
        !allowDocuments &&
        /map|diagram|coat of arms|flag|logo|icon|drawing|floor plan|site plan/i.test(
          lowerTitle
        )
      ) {
        return [];
      }

      const artist = cleanHtml(
        info.extmetadata?.Artist?.value
      );

      return [
        {
          title,
          url: info.url,
          downloadUrl: info.thumburl || info.url,
          mime: info.mime,
          license,
          artist,
          width: info.width || 0,
          height: info.height || 0
        }
      ];
    })
    .sort((a, b) => {
      const score = (candidate: SelectedCommonsImage) => {
        const title = candidate.title.toLowerCase();

        const tokenScore = queryTokens.filter((token) =>
          title.includes(token)
        ).length * 5;

        const dimensionScore =
          Math.min(
            4,
            Math.max(candidate.width, candidate.height) / 1000
          );

        const ukScore =
          /uk|united kingdom|british|england|london|croydon|manchester|birmingham|leeds/i.test(
            title
          )
            ? 5
            : 0;

        return tokenScore + dimensionScore + ukScore;
      };

      return score(b) - score(a);
    });
}

async function downloadImage(
  candidate: SelectedCommonsImage,
  destination: string,
  config: NoApiVisualConfig
): Promise<void> {
  const response = await fetchWithTimeout(
    candidate.downloadUrl,
    {
      headers: {
        "user-agent":
          "PlandomeVideoStudio/2.0 (UK property advert renderer)"
      }
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new Error(
      `Wikimedia image download returned HTTP ${response.status}.`
    );
  }

  const data = Buffer.from(await response.arrayBuffer());

  if (data.length < config.minimumImageBytes) {
    throw new Error(
      `Downloaded image was only ${data.length} bytes.`
    );
  }

  await writeFile(destination, data);
}

async function createCinematicVideo(
  imagePath: string,
  outputPath: string,
  sceneIndex: number,
  durationSeconds: number
): Promise<void> {
  const preset = cameraPresetForScene(sceneIndex);
  const duration = Math.max(
    3,
    Math.min(12, durationSeconds)
  );

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
      "fps=30"
    ].join(":"),
    "eq=contrast=1.045:saturation=0.94:brightness=-0.018",
    "unsharp=5:5:0.32:5:5:0",
    "format=yuv420p"
  ].join(",");

  await exec(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      imagePath,
      "-vf",
      filters,
      "-t",
      duration.toFixed(3),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    ],
    {
      maxBuffer: 10_000_000
    }
  );
}

export async function generateNoApiCinematicVisual(
  request: NoApiVisualRequest,
  config = getNoApiVisualConfig()
): Promise<NoApiVisualResult> {
  if (!config.enabled) {
    return {
      success: false,
      sceneId: request.sceneId,
      attempts: 0,
      error: "No-API visual generation is disabled."
    };
  }

  await mkdir(config.outputDirectory, {
    recursive: true
  });

  const usedSourceUrls =
    request.usedSourceUrls || new Set<string>();

  const queries = buildNoApiQueryTiers(request).slice(
    0,
    config.maximumQueries
  );

  const seed = stableHash(
    `${request.sceneId}:${request.sceneIndex}:${request.subject}`
  );

  let attempts = 0;
  let lastError = "No suitable UK media was found.";

  for (const query of queries) {
    attempts += 1;

    try {
      const pages = await searchCommons(
        query,
        config.timeoutMs
      );

      const candidates = selectCandidates(
        pages,
        query,
        request.category,
        usedSourceUrls
      );

      if (candidates.length === 0) {
        lastError = `No licensed photographic candidates for: ${query}`;
        continue;
      }

      for (
        let offset = 0;
        offset < Math.min(candidates.length, 12);
        offset += 1
      ) {
        const candidate =
          candidates[(seed + offset) % candidates.length];

        if (!candidate) continue;

        const sourceHash = createHash("sha1")
          .update(candidate.url)
          .digest("hex")
          .slice(0, 10);

        const extension =
          candidate.mime === "image/png" ? ".png" : ".jpg";

        const baseName = `${safeFilePart(
          request.sceneId
        )}-${sourceHash}`;

        const imagePath = path.join(
          config.outputDirectory,
          `${baseName}${extension}`
        );

        const videoPath = path.join(
          config.outputDirectory,
          `${baseName}.mp4`
        );

        try {
          await downloadImage(
            candidate,
            imagePath,
            config
          );

          await createCinematicVideo(
            imagePath,
            videoPath,
            request.sceneIndex,
            request.durationSeconds
          );

          const video = await stat(videoPath);

          if (video.size < config.minimumVideoBytes) {
            throw new Error(
              `Cinematic clip was only ${video.size} bytes.`
            );
          }

          usedSourceUrls.add(candidate.url);

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
            attempts
          };
        } catch (error) {
          lastError =
            error instanceof Error
              ? error.message
              : "Media conversion failed.";

          await unlink(imagePath).catch(() => undefined);
          await unlink(videoPath).catch(() => undefined);
        }
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Wikimedia media search failed.";
    }
  }

  return {
    success: false,
    sceneId: request.sceneId,
    attempts,
    error: lastError
  };
}
