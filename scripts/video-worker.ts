import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { VideoJob } from "../apps/web/lib/video/types";
import { getVideoJob, jobDirectory, saveVideoJob } from "../apps/web/lib/video/job-store";
import { writeCanvaStoryboard, writeComposition, type MotionVisual, type PlannedScene } from "./video-composition";
import { createVisualBrief, validateVideoPlan } from "./video-quality";
import { resolveGalleryAsset } from "./visual-gallery";
import type { ScoredGalleryAsset } from "./visual-gallery";
import { selectCreative } from "../apps/web/lib/video/creative-system";
import { readGenerationHistory, saveGenerationHistory } from "./generation-history";
import { splitScript } from "./script-scenes";
import { planVisualScenes } from "./universal-visual-planner";
import { resolvePremiumSceneVisual } from "./premium-visual-orchestrator";
import { assertPremiumAdMedia } from "./premium-ad-quality-gate";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  return readFile(path.join(root, "apps/web/.env.local"), "utf8").then((text) => {
    for (const line of text.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) process.env[match[1]] ??= match[2].trim().replace(/^['\"]|['\"]$/g, ""); }
  }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
}

async function update(job: VideoJob, status: VideoJob["status"], progress: number, stage: string) { Object.assign(job, { status, progress, stage }); await saveVideoJob(job); }
function sceneKind(text: string, index: number, total: number, useAvatar: boolean): PlannedScene["kind"] { if (index === 0 && useAvatar) return "avatar"; const value = text.toLowerCase(); if (index === total - 1 && /book|download|get your|contact|start|visit|call|decision pack|next step/.test(value)) return "cta"; if (/decision pack|Â£99|\$99/.test(value)) return "pack"; if (/[Â£$â‚¬]\s?\d|cost|spend|investment|lost trading|expensive mistake/.test(value)) return "cost"; if (/risk|regulation|compliance|access|article 4|licensing|drainage|flood|party wall|structural damage/.test(value)) return "risk"; if (/permission|planning|council|route|use class|local policy/.test(value)) return "planning"; return "property"; }
function hashText(value: string) { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function headline(text: string, index: number, total: number) {
  if (index >= 0 && total > 0) return text.replace(/[?!.,]/g, "").trim().split(/\s+/).slice(0, 7).join(" ");
  if (index === total - 1) { if (/free.*assessment|book/i.test(text)) return "Book your free assessment"; if (/audit/i.test(text)) return "Request your planning audit"; if (/decision pack|Â£99/i.test(text)) return "Get your Decision Pack"; return "Check the route first"; }
  const clean = text.replace(/[?!.,]/g, "").trim();
  const money = clean.match(/[Â£$â‚¬]\s?[\d,.]+(?:\s*[â€“-]\s*[Â£$â‚¬]?\s?[\d,.]+)?(?:k|m)?/i)?.[0];
  if (money) return clean.split(/\s+/).slice(0, 7).join(" ");
  const priority = clean.match(/(?:planning|permission|building regulations|project risks?|commercial project|before you spend|clear next step)/i)?.[0];
  if (priority) return priority.length < 8 ? `Check ${priority}` : priority;
  return clean.split(/\s+/).slice(0, 6).join(" ");
}
function visualQuery(text: string) {
  const value = text.toLowerCase();
  if (/rear extension|extension/.test(value)) return "United Kingdom Victorian terraced house rear extension";
  if (/loft|roof/.test(value)) return "United Kingdom Victorian house loft conversion roof";
  if (/access|neighbour|boundary/.test(value)) return "United Kingdom Victorian terraced house side access boundary";
  if (/regulation|compliance|building control/.test(value)) return "United Kingdom residential construction building inspection";
  if (/risk|survey|assessment|structural/.test(value)) return "United Kingdom Victorian property building survey inspection";
  if (/permission|planning|council/.test(value)) return "United Kingdom planning application architectural drawings council";
  if (/commercial|office|shop|retail/.test(value)) return "United Kingdom Victorian commercial property shopfront architecture";
  if (/cost|budget|spend/.test(value)) return "United Kingdom construction cost plans quantity surveyor";
  if (/victorian|heritage|period/.test(value)) return "United Kingdom Victorian terraced house architecture";
  return "United Kingdom residential architecture property exterior";
}
function visualQueryTiers(text: string, brief: PlannedScene["brief"]) {
  const value = text.toLowerCase();
  const specific = /rear extension|extension/.test(value) ? ["rear extension terraced house UK", "house extension London"] :
    /loft|roof/.test(value) ? ["loft conversion London house", "Victorian roof London"] :
      /drawing|plan|permission|council/.test(value) ? ["UK architectural planning drawings", "British planning application"] :
        /regulation|compliance|construction/.test(value) ? ["UK building construction inspection", "British building control"] :
          /risk|survey|structural/.test(value) ? ["UK property building survey", "British house inspection"] :
            /commercial|office|shop|retail/.test(value) ? ["British commercial property London", "UK high street shopfront"] :
              /cost|budget|spend|invest|delay|redesign/.test(value) ? ["UK quantity surveyor construction plans", "British house renovation plans"] :
                ["Victorian terraced house London", "British residential street architecture"];
  return [...specific, visualQuery(text), `${brief.architecture} ${brief.object} UK`];
}
function motionVisualFor(scene: PlannedScene): MotionVisual {
  const value = scene.text.toLowerCase();
  if (/structural damage|crack|movement|subsidence/.test(value)) return "structural-damage";
  if (/foundation|footing|underpin|deeper/.test(value)) return "foundation-detail";
  if (/soil|clay|moisture|shrink|swell|dry period|when wet/.test(value)) return "soil-movement";
  if (/tree|root|oak/.test(value)) return "tree-risk";
  if (/Â£|cost|budget|fee|price|overrun|money|financial/.test(value)) return "cost-analysis";
  if (/week|month|timeline|schedule|delay|deadline|programme/.test(value)) return "project-timeline";
  if (/check|due diligence|verify|review|decision|feasibility/.test(value)) return "compliance-check";
  if (/rear extension|extension|rear garden/.test(value)) return "victorian-rear-extension";
  if (/drawing|plan|permission|council|application/.test(value)) return "planning-drawings";
  if (/commercial|office|shop|retail|high street/.test(value)) return "commercial-property";
  if (/risk|survey|structural|regulation|compliance|access|boundary|drainage|flood|party wall/.test(value)) return "property-survey";
  return "victorian-terrace";
}
async function hydratePreviousSceneVisuals(currentId: string, script: string, assets: string, seed: number, sceneCount: number) {
  const candidates: Array<{ id: string; updated: string }> = []; try { for (const entry of await readdir(path.join(root, ".data/video-jobs"), { withFileTypes: true })) { if (!entry.isDirectory() || entry.name === currentId) continue; try { const job = JSON.parse(await readFile(path.join(root, ".data/video-jobs", entry.name, "job.json"), "utf8")) as VideoJob; if (job.input.script === script) candidates.push({ id: entry.name, updated: job.updatedAt }); } catch {/* Ignore incomplete job directories. */ } } } catch { return; }
  candidates.sort((a, b) => b.updated.localeCompare(a.updated)); for (let index = 0; index < sceneCount; index++) { const available = []; for (const candidate of candidates.slice(0, 12)) { const file = path.join(root, ".data/video-jobs", candidate.id, "composition/assets", `uk-visual-${index}.jpg`); try { if ((await stat(file)).size >= 50_000) available.push(file); } catch {/* This generation did not resolve the scene. */ } } if (available.length) { const selected = available[(seed + index * 7) % available.length]!; await copyFile(selected, path.join(assets, `uk-visual-${index}.jpg`)); } }
}
type CommonsPage = { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }> };
const commonsSearchCache = new Map<string, CommonsPage[]>();

async function searchCommons(query: string): Promise<CommonsPage[]> {
  const cacheKey = query.trim().toLowerCase(); const cached = commonsSearchCache.get(cacheKey); if (cached) return cached;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "50", prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: "1920", maxlag: "5", format: "json", origin: "*" }).toString();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "PlandomeVideoStudio/1.0 (UK planning video renderer)" }, signal: AbortSignal.timeout(15_000) }); lastStatus = response.status;
      if (response.ok) { const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } }; const pages = Object.values(payload.query?.pages ?? {}); commonsSearchCache.set(cacheKey, pages); return pages; }
      if (response.status !== 429 && response.status < 500) throw new Error(`UK visual search failed (${response.status}).`);
      const retryAfter = Number(response.headers.get("retry-after")); await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1_500 * (attempt + 1)));
    } catch (cause) { if (attempt === 1) throw cause; await new Promise((resolve) => setTimeout(resolve, 750)); }
  }
  throw new Error(`UK visual search failed (${lastStatus || "network"}).`);
}

export async function fetchUkVisual(query: string, seed: number, output: string, usedSources: Set<string>) {
  try { if ((await stat(output)).size >= 50_000) return { title: query, source: `local-cache:${path.basename(output)}`, license: "Previously validated local scene cache" }; } catch { /* Resolve a fresh licensed visual below. */ }
  const queryTokens = query.toLowerCase().split(/\W+/).filter((token) => token.length > 3);
  const candidates = (await searchCommons(query)).filter((page) => { const info = page.imageinfo?.[0]; const license = info?.extmetadata?.LicenseShortName?.value ?? ""; return info?.mime === "image/jpeg" && Boolean(info.url) && !usedSources.has(info.url!) && Math.max(info.width ?? 0, info.height ?? 0) >= 1600 && /CC|Public domain/i.test(license) && !/america|united states|california|florida|texas/i.test(page.title ?? ""); }).sort((a, b) => { const score = (page: CommonsPage) => queryTokens.filter((token) => page.title?.toLowerCase().includes(token)).length; return score(b) - score(a); });
  if (!candidates.length) throw new Error("No reusable UK visual was found for this scene.");
  let lastStatus: number | undefined;
  for (let offset = 0; offset < Math.min(candidates.length, 8); offset++) {
    const selected = candidates[(seed + offset) % candidates.length]; const info = selected.imageinfo![0];
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const image = await fetch(info.thumburl ?? info.url!, { headers: { "user-agent": "PlandomeVideoStudio/1.0 (UK planning video renderer)" }, signal: AbortSignal.timeout(20_000) }); lastStatus = image.status; if (!image.ok) { if (image.status === 429 || image.status >= 500) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1))); continue; } const data = Buffer.from(await image.arrayBuffer()); if (data.length < 50_000) break; await writeFile(output, data); usedSources.add(info.url!); return { title: selected.title, source: info.url, license: info.extmetadata?.LicenseShortName?.value, artist: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") }; } catch { await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1))); }
    }
  }
  throw new Error(`Reusable UK visuals were found, but their media downloads failed${lastStatus ? ` (last HTTP ${lastStatus})` : ""}.`);
}

export async function fetchUkVictorianVideo(seed: number, output: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", titles: "File:A Trip Through The Streets of London, Sep 26, 1917.webm", prop: "imageinfo", iiprop: "url|mime|size|derivatives|extmetadata", format: "json", origin: "*" }).toString();
  const response = await fetch(url, { headers: { "user-agent": "PlandomeVideoStudio/1.0" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`UK Victorian video search failed (${response.status}).`);
  type VideoPage = CommonsPage & { imageinfo?: Array<CommonsPage["imageinfo"] extends Array<infer T> ? T & { size?: number; derivatives?: Array<{ src?: string; type?: string; width?: number; height?: number }> } : never> };
  const payload = await response.json() as { query?: { pages?: Record<string, VideoPage> } };
  const candidates = Object.values(payload.query?.pages ?? {}).filter((page) => { const info = page.imageinfo?.[0]; const license = info?.extmetadata?.LicenseShortName?.value ?? ""; return info?.mime?.startsWith("video/") && Boolean(info.url) && /CC|Public domain/i.test(license); });
  if (!candidates.length) throw new Error("No reusable UK Victorian video was found.");
  const selected = candidates[seed % candidates.length]; const info = selected.imageinfo![0]; const derivatives = info.derivatives ?? []; const derivative = derivatives.filter((item) => item.type?.startsWith("video/webm") && (item.width ?? 0) >= 480 && (item.width ?? 0) <= 1280).sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).at(-1); const mediaUrl = derivative?.src ?? ((info.size ?? Infinity) < 80_000_000 && info.mime === "video/webm" ? info.url : undefined); if (!mediaUrl) throw new Error("No render-sized WebM derivative was available."); const media = await fetch(mediaUrl); if (!media.ok) throw new Error("UK Victorian video download failed.");
  await writeFile(output, Buffer.from(await media.arrayBuffer()));
  return { title: selected.title, source: info.url, media: mediaUrl, license: info.extmetadata?.LicenseShortName?.value, artist: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") };
}

type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
async function narration(text: string, output: string): Promise<Alignment> {
  const key = process.env.ELEVENLABS_API_KEY; const voice = process.env.ELEVENLABS_ELLA_VOICE_ID;
  if (!key || !voice) throw new Error("ElevenLabs is not configured.");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps`, { method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" }, body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: .55, similarity_boost: .78, style: .25, use_speaker_boost: true, speed: 1 } }) });
  if (!response.ok) throw new Error(`ElevenLabs speech generation failed (${response.status}).`);
  const payload = await response.json() as { audio_base64?: string; alignment?: Alignment };
  if (!payload.audio_base64 || !payload.alignment) throw new Error("ElevenLabs did not return speech alignment.");
  await writeFile(output, Buffer.from(payload.audio_base64, "base64"));
  return payload.alignment;
}

function alignedSceneTimes(script: string, lines: string[], alignment: Alignment, duration: number) {
  const spoken = alignment.characters.join(""); let searchFrom = 0;
  return lines.map((line, index) => { const exact = spoken.indexOf(line, searchFrom); const startIndex = exact >= searchFrom ? exact : searchFrom; const nextLine = lines[index + 1]; const nextExact = nextLine ? spoken.indexOf(nextLine, Math.min(spoken.length, startIndex + Math.max(1, line.length - 3))) : -1; const start = alignment.character_start_times_seconds[startIndex] ?? (duration * index / lines.length); const endIndex = nextExact > startIndex ? nextExact - 1 : Math.min(alignment.character_end_times_seconds.length - 1, startIndex + line.length - 1); const end = index === lines.length - 1 ? duration : (alignment.character_end_times_seconds[endIndex] ?? duration * (index + 1) / lines.length); searchFrom = Math.max(startIndex + line.length, endIndex + 1); return { start, duration: Math.max(.8, end - start) }; });
}

function weightedSceneTimes(lines: string[], duration: number) {
  const weights = lines.map((line) => Math.max(1, line.replace(/\s+/g, " ").length)); const total = weights.reduce((sum, weight) => sum + weight, 0); let elapsed = 0;
  return weights.map((weight, index) => { const start = elapsed; const end = index === weights.length - 1 ? duration : elapsed + duration * weight / total; elapsed = end; return { start, duration: Math.max(.8, end - start) }; });
}

function mediaBinary(name: "ffmpeg" | "ffprobe") { return process.platform === "win32" ? path.join(root, "tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin", `${name}.exe`) : name; }
async function audioDuration(file: string) { const { stdout } = await exec(mediaBinary("ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]); return Number(stdout.trim()); }

async function createAvatar(hook: string, output: string) {
  const key = process.env.HEYGEN_API_KEY; const avatar = process.env.HEYGEN_ELLA_AVATAR_ID ?? "Masha_standing_office_front";
  if (!key) throw new Error("HeyGen is not configured.");
  const prompt = `Create a 3 to 5 second portrait presenter clip. Use the selected avatar standing, framed from mid-thigh upward, facing camera in a modern neutral UK architecture office. She must say exactly: ${JSON.stringify(hook)}. Do not add captions, logos, music, B-roll, or extra words. Keep the background bright and uncluttered.`;
  const created = await fetch("https://api.heygen.com/v3/video-agents", { method: "POST", headers: { "x-api-key": key, "content-type": "application/json" }, body: JSON.stringify({ prompt, mode: "generate", avatar_id: avatar, orientation: "portrait", incognito_mode: true }) });
  if (!created.ok) throw new Error(`HeyGen avatar generation failed (${created.status}). Check that HEYGEN_API_KEY is an API key, not the Codex OAuth connection.`);
  const payload = await created.json() as { data?: { video_id?: string } }; const id = payload.data?.video_id; if (!id) throw new Error("HeyGen did not return a video ID.");
  for (let attempt = 0; attempt < 60; attempt++) { await new Promise((resolve) => setTimeout(resolve, 5_000)); const response = await fetch(`https://api.heygen.com/v3/videos/${id}`, { headers: { "x-api-key": key } }); if (!response.ok) continue; const body = await response.json() as { data?: { status?: string; video_url?: string; error?: { message?: string } } }; if (body.data?.status === "failed") throw new Error(body.data.error?.message ?? "HeyGen avatar generation failed."); if (body.data?.status === "completed" && body.data.video_url) { const video = await fetch(body.data.video_url); if (!video.ok) throw new Error("HeyGen video download failed."); await writeFile(output, Buffer.from(await video.arrayBuffer())); return; } }
  throw new Error("HeyGen avatar generation timed out.");
}

async function main() {
  await loadEnv(); const id = process.argv[2]; const job = await getVideoJob(id); if (!job) throw new Error("Job not found."); delete job.error; const dir = jobDirectory(id); const assets = path.join(dir, "composition/assets");
  try {
    await update(job, "planning", 8, "Analysing script and matching UK visuals"); const lines = splitScript(job.input.script);
    await mkdir(assets, { recursive: true }); await update(job, "narrating", 20, "Generating ElevenLabs voiceover");
    const narrationFile = path.join(assets, "narration.mp3"); const alignmentFile = path.join(dir, "narration-alignment.json"); let alignment: Alignment | undefined; let duration: number;
    try { duration = Math.max(6, await audioDuration(narrationFile)); try { alignment = JSON.parse(await readFile(alignmentFile, "utf8")) as Alignment; } catch { /* Existing jobs created before alignment persistence use weighted timings. */ } } catch { alignment = await narration(job.input.script, narrationFile); await writeFile(alignmentFile, JSON.stringify(alignment)); duration = Math.max(6, await audioDuration(narrationFile)); }
    const seed = Number.parseInt(job.variationSeed.slice(0, 8), 16); const history = await readGenerationHistory(root, job.projectId); const creative = selectCreative({ generationId: job.generationId, variationSeed: job.variationSeed, projectId: job.projectId }, history, lines.length); const timings = alignment ? alignedSceneTimes(job.input.script, lines, alignment, duration) : weightedSceneTimes(lines, duration); const scenes: PlannedScene[] = lines.map((line, index) => { const short = headline(line, index, lines.length); const context = index > 0 ? `${lines[index - 1]} ${line}` : line; const brief = createVisualBrief(context, index + seed); brief.sentence = line; return { text: line, headline: short, ...timings[index], kind: sceneKind(context, index, lines.length, job.input.useAvatar), brief }; });
    await writeFile(path.join(dir, "scene-briefs.json"), JSON.stringify(scenes.map((scene) => scene.brief), null, 2));
    if (job.input.useAvatar) { await update(job, "avatar", 38, "Generating standing Ella hook"); await createAvatar(lines[0], path.join(assets, "ella.mp4")); }
    await update(job, "composing", job.input.useAvatar ? 57 : 42, "Designing line-matched HyperFrames scenes"); await copyFile(path.join(root, "apps/web/public/brand/plandome-logo.png"), path.join(assets, "logo.png"));
    const attributions: Array<Record<string, unknown>> = scenes.map((scene, index) => ({
      id: `plandome-composition:${index}`,
      title: `Plandome branded ${scene.kind} scene`,
      source: "generated:plandome-composition",
      license: "Original Plandome composition"
    }));
    const candidateScores: ScoredGalleryAsset[] = [];
    const recentAssetIds = new Set(history.slice(0, 3).flatMap((item) => item.assetIds));
    const usedGalleryIds = new Set<string>();
    const usedSources = new Set<string>();
    const usedPremiumAssetPaths = new Set<string>();
    const usedPremiumSourceUrls = new Set<string>();
    const usedPremiumImageHashes = new Set<string>();

    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];

      if (["avatar", "cta", "pack"].includes(scene.kind)) continue;

      scene.motionVisual = undefined;
      scene.visualAsset = undefined;
      scene.videoAsset = undefined;

      const generatedPlans = planVisualScenes(lines[index]);
      const planned = generatedPlans[0];

      if (!planned) {
        throw new Error(`The premium visual planner did not create scene ${index + 1}.`);
      }

      let premiumFailure = "";

      try {
        const resolved = await resolvePremiumSceneVisual(
          {
            ...planned,
            sceneId: `scene-${String(index + 1).padStart(2, "0")}`,
            durationSeconds: scene.duration
          },
          {
            sceneIndex: index,
            totalScenes: scenes.length,
            fullScript: job.input.script,
            usedAssetPaths: usedPremiumAssetPaths,
            usedSourceUrls: usedPremiumSourceUrls,
            usedImageHashes: usedPremiumImageHashes
          }
        );

        if (resolved.success && resolved.assetPath) {
          usedPremiumAssetPaths.add(
            path.resolve(resolved.assetPath)
          );

          const sourceExtension = path.extname(resolved.assetPath).toLowerCase();
          const videoExtensions = new Set([".mp4", ".mov", ".webm", ".m4v"]);
          const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

          if (!videoExtensions.has(sourceExtension) && !imageExtensions.has(sourceExtension)) {
            throw new Error(`Unsupported premium visual format: ${sourceExtension || "unknown"}.`);
          }

          const outputName = `premium-visual-${index}${sourceExtension}`;
          await copyFile(resolved.assetPath, path.join(assets, outputName));

          if (videoExtensions.has(sourceExtension)) {
            scene.videoAsset = outputName;
          } else {
            scene.visualAsset = outputName;
          }

          attributions[index] = {
            id: `premium:${index}:${resolved.source}`,
            title: `Photorealistic premium visual for scene ${index + 1}`,
            source: resolved.source,
            mode: resolved.mode,
            attempts: resolved.attempts,
            originalAsset: resolved.assetPath,
            license:
              resolved.source === "no_api_commons"
                ? "Licensed Wikimedia Commons media transformed into an original Plandome motion clip"
                : resolved.source === "comfyui"
                  ? "Optional ComfyUI visual asset"
                  : "Plandome premium visual asset",
            sourceUrl: resolved.metadata?.sourceUrl,
            sourceTitle: resolved.metadata?.sourceTitle,
            artist: resolved.metadata?.artist,
            query: resolved.metadata?.query
          };

          continue;
        }

        premiumFailure =
          resolved.error ||
          "Premium visual generation returned no media.";
      } catch (cause) {
        premiumFailure = cause instanceof Error
          ? cause.message
          : "Premium visual generation failed.";
      }

      if (!scene.videoAsset && !scene.visualAsset) {
        throw new Error(
          `Scene ${index + 1} has no realistic premium media. ` +
          `Premium generation: ${premiumFailure || "not available"}. ` +
          "No fallback beyond the licensed premium media pipeline is allowed."
        );
      }
    }

    const unresolvedRealisticScenes = scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) =>
        !["avatar", "cta", "pack"].includes(scene.kind) &&
        !scene.visualAsset &&
        !scene.videoAsset
      );

    if (unresolvedRealisticScenes.length > 0) {
      throw new Error(
        `Realistic media is missing for scenes: ${unresolvedRealisticScenes
          .map(({ index }) => index + 1)
          .join(", ")}. CSS and cartoon fallbacks are disabled.`
      );
    }

    const premiumMediaReport = await assertPremiumAdMedia(
      scenes,
      assets,
      attributions
    );

    await writeFile(
      path.join(dir, "premium-media-report.json"),
      JSON.stringify(premiumMediaReport, null, 2)
    );

    const report = validateVideoPlan(scenes); await writeFile(path.join(dir, "quality-report.json"), JSON.stringify(report, null, 2)); if (!report.passed) { const failures = report.scenes.filter((scene) => !scene.passed).map((scene) => `scene ${scene.index + 1}: ${scene.failures.join(" ")}`).join("; "); throw new Error(`Video quality validation failed: ${failures}`); }
    const design = { generationId: job.generationId, templateIndex: Math.max(0, creative.template.id.length % 12), template: creative.template.name, paletteIndex: creative.palette.id.length, palette: { paper: creative.palette.background, ink: creative.palette.primaryText, accent: creative.palette.accent, secondary: creative.palette.surface }, fontIndex: creative.fontPair.id.length, fonts: { heading: creative.fontPair.headingFont, body: creative.fontPair.bodyFont }, overlay: (creative.template.overlayStyle === "glass" ? "glass" : creative.template.overlayStyle === "paper" ? "editorial" : "solid") as "solid" | "glass" | "editorial" | "outline", templateId: creative.template.id, layoutFamily: creative.template.layoutFamily, sceneLayouts: creative.sceneLayouts, transitions: creative.transitions, motionPresets: creative.motionPresets, textStyles: creative.textStyles, creativeFingerprint: creative.creativeFingerprint }; job.creativeFingerprint = creative.creativeFingerprint; await writeFile(path.join(dir, "design-profile.json"), JSON.stringify(design, null, 2)); await writeFile(path.join(dir, "visual-attributions.json"), JSON.stringify(attributions, null, 2)); await writeFile(path.join(dir, "generation-inspector.json"), JSON.stringify({ generationId: job.generationId, variationSeed: job.variationSeed, selectedTemplate: creative.template, rejectedTemplates: creative.rejectedTemplateIds, selectedPalette: creative.palette, rejectedPalettes: creative.rejectedPaletteIds, selectedFontPair: creative.fontPair, rejectedFontPairs: creative.rejectedFontPairIds, scenes: scenes.map((scene, index) => ({ narration: scene.text, query: scene.brief.searchQuery, candidates: candidateScores.filter(x => x.asset.id === String((attributions[index] as { id?: string })?.id)), selectedAsset: attributions[index], validation: report.scenes[index] })), creativeFingerprint: creative.creativeFingerprint, canvaStatus: "not-connected" }, null, 2)); await writeComposition(path.join(dir, "composition"), scenes, duration, job.input.useAvatar, design); await writeCanvaStoryboard(path.join(dir, "composition"), scenes, design);
    await update(job, "rendering", 70, "Rendering animated MP4"); const ffmpegDir = path.join(root, "tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin"); const hyperframes = path.join(root, "node_modules/hyperframes/dist/cli.js"); const renderEnv = { ...process.env, PATH: process.platform === "win32" ? `${ffmpegDir}${path.delimiter}${process.env.PATH}` : process.env.PATH }; const silentOutput = path.join(dir, "visual-master.mp4"); const finalOutput = path.join(dir, "output.mp4"); await exec(process.execPath, [hyperframes, "lint", path.join(dir, "composition")], { env: renderEnv }); await exec(process.execPath, [hyperframes, "render", path.join(dir, "composition"), "--output", silentOutput, "--quality", job.input.quality === "production" ? "high" : "standard", "--fps", "30", "--workers", process.env.RENDER_WORKERS ?? "2", "--strict"], { env: renderEnv, maxBuffer: 10_000_000 }); await exec(mediaBinary("ffmpeg"), ["-y", "-i", silentOutput, "-i", narrationFile, "-filter_complex", `[1:a]apad=whole_dur=${duration.toFixed(6)}[voice]`, "-map", "0:v:0", "-map", "[voice]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", duration.toFixed(6), "-movflags", "+faststart", finalOutput], { env: renderEnv, maxBuffer: 10_000_000 });
    const assetIds = attributions.map(x => String((x as { id?: string }).id ?? (x as { source?: string }).source ?? "")).filter(Boolean); await saveGenerationHistory(root, { generationId: job.generationId, projectId: job.projectId, variationSeed: job.variationSeed, templateId: creative.template.id, layoutFamily: creative.template.layoutFamily, paletteId: creative.palette.id, fontPairId: creative.fontPair.id, assetIds, sceneFingerprints: scenes.map(scene => hashText(`${scene.text}:${scene.brief.searchQuery}`).toString(16)), creativeFingerprint: creative.creativeFingerprint, createdAt: new Date().toISOString() }); job.outputUrl = `/api/v1/video-jobs/${id}/download`; job.canvaUrl = `/api/v1/video-jobs/${id}/canva`; job.inspectorUrl = `/api/v1/video-jobs/${id}/inspector`; await update(job, "completed", 100, "Video and Canva storyboard ready");
  } catch (cause) { job.error = { code: "pipeline_failed", message: cause instanceof Error ? cause.message : "Video generation failed." }; await update(job, "failed", job.progress, "Generation failed"); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void main();
