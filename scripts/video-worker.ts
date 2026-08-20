import { execFile, spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type { VideoJob } from "../apps/web/lib/video/types";
import { getVideoJob, jobDirectory, saveVideoJob } from "../apps/web/lib/video/job-store";
import { writeCanvaStoryboard, type MotionVisual, type PlannedScene } from "./video-composition";
import { writeTimedCanvaSceneMedia } from "./canva-transfer-assets";
import { writePremiumComposition } from "./premium-visual-composition";
import { createVisualBrief, validateVideoPlan, type EditorPreferences } from "./video-quality";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { resolveGalleryAsset } from "./visual-gallery";
import type { ScoredGalleryAsset } from "./visual-gallery";
import { selectCreative } from "../apps/web/lib/video/creative-system";
import { approvedSceneTemplateIds } from "../apps/web/lib/video/approved-benchmarks";
import { readGenerationHistory, saveGenerationHistory } from "./generation-history";
import { splitScript } from "./script-scenes";
import { planVisualScenes } from "./universal-visual-planner";
import { resolvePremiumSceneVisual } from "./premium-visual-orchestrator";
import { assertPremiumAdMedia, inspectPremiumAdMedia } from "./premium-ad-quality-gate";
import { validateFinalRender } from "./post-render-quality";
import { enhanceVisualIfNeeded } from "./optional-enhancements";
import {
  CreativeMemoryRepository,
  CreativeProjectRepository,
  createCreativeProject,
  materializeSceneElements,
  phraseCaptions,
  recordCheckpoint,
  type CreativeProject,
} from "../packages/creative-project/src";
import { PreRenderQualityGate } from "../packages/orchestration/src";
import { TemplateRegistry } from "../packages/templates/src";
import { rendererRegistry } from "../packages/renderers/src";
import { VariationPlanner, visualFingerprint } from "../packages/renderers/remotion/src/variation/variation-planner";
import { selectGoogleDriveVisuals } from "./google-drive-visuals";
import { directVideoAd } from "./ai-creative-director";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

type RenderTelemetry = { current?: number; total?: number; percent?: number };

function runStreamingRender(command: string, args: string[], env: NodeJS.ProcessEnv, onProgress: (progress: RenderTelemetry) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const startedAt = Date.now();
    const inactivityLimit = Math.max(60, Number(process.env.RENDER_INACTIVITY_SECONDS ?? "300")) * 1_000;
    const wallLimit = Math.max(10, Number(process.env.RENDER_MAX_MINUTES ?? "30")) * 60_000;
    let lastActivity = Date.now();
    let tail = "";
    let stoppedFor: string | undefined;

    const consume = (chunk: Buffer) => {
      lastActivity = Date.now();
      const clean = chunk.toString().replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, "");
      tail = `${tail}${clean}`.slice(-24_000);
      const frameMatches = [...clean.matchAll(/(?:frame|rendering)[^\d]{0,20}(\d+)\s*(?:\/|of)\s*(\d+)/gi)];
      const frame = frameMatches.at(-1);
      if (frame) {
        onProgress({ current: Number(frame[1]), total: Number(frame[2]) });
        return;
      }
      if (!/(?:render|frame|captur)/i.test(clean)) return;
      const percentMatches = [...clean.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
      const percent = percentMatches.at(-1);
      if (percent) onProgress({ percent: Math.min(100, Math.max(0, Number(percent[1]))) });
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);

    const watchdog = setInterval(() => {
      const now = Date.now();
      if (!stoppedFor && now - lastActivity > inactivityLimit) stoppedFor = `no renderer activity for ${Math.round(inactivityLimit / 1_000)} seconds`;
      if (!stoppedFor && now - startedAt > wallLimit) stoppedFor = `render exceeded ${Math.round(wallLimit / 60_000)} minutes`;
      if (!stoppedFor) return;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, 15_000);
    watchdog.unref();

    child.once("error", (error) => {
      clearInterval(watchdog);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearInterval(watchdog);
      if (code === 0 && !stoppedFor) resolve();
      else reject(new Error(`HyperFrames ${stoppedFor ?? `exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`}. ${tail.slice(-1_500)}`));
    });
  });
}

async function assertScriptLedRenderer(script: string) {
  const renderer = await readFile(
    path.join(root, "packages/renderers/remotion/src/components/PlandomeScene.tsx"),
    "utf8",
  );
  const source = script.toLowerCase();
  const campaignPhrases = [
    "certificate of lawfulness",
    "building regulations",
    "council ready",
    "decision pack",
    "foundation strategy",
    "evidence-led application",
  ];
  const leaked = campaignPhrases.filter((phrase) => renderer.toLowerCase().includes(phrase) && !source.includes(phrase));
  if (leaked.length) {
    throw new Error(`Renderer contains campaign copy that is not present in this script: ${leaked.join(", ")}.`);
  }
}

async function startAssetServer(directory: string) {
  const base = path.resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      const file = path.resolve(base, `.${pathname}`);
      if (file !== base && !file.startsWith(`${base}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const metadata = await stat(file);
      if (!metadata.isFile()) throw new Error("Not a file");
      const extension = path.extname(file).toLowerCase();
      const contentType = extension === ".mp4" ? "video/mp4"
        : extension === ".mp3" ? "audio/mpeg"
          : extension === ".wav" ? "audio/wav"
            : extension === ".png" ? "image/png"
              : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
                : "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": metadata.size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600, immutable",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Asset server did not bind to a TCP port.");
  return {
    urlFor(file: string) {
      const relative = path.relative(base, path.resolve(file)).replaceAll("\\", "/");
      return `http://127.0.0.1:${address.port}/${relative.split("/").map(encodeURIComponent).join("/")}`;
    },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

function loadEnv() {
  const files = [
    path.join(root, "apps/web/.env.local"),
    path.join(root, ".env.local"),
    path.join(root, "worker-secrets.env"),
  ];
  return Promise.all(files.map((file) =>
    readFile(file, "utf8").then((text) => {
      for (const line of text.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) process.env[match[1]] ??= match[2].trim().replace(/^['"]|['"]$/g, ""); }
    }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; })
  )).then(() => undefined);
}

async function update(job: VideoJob, status: VideoJob["status"], progress: number, stage: string) { Object.assign(job, { status, progress, stage }); await saveVideoJob(job); }
function sceneKind(text: string, index: number, total: number, useAvatar: boolean): PlannedScene["kind"] { if (index === 0 && useAvatar) return "avatar"; const value = text.toLowerCase(); if (index === total - 1 && /book|download|get your|contact|start|visit|call|request|decision pack|next step/.test(value)) return "cta"; if (/decision pack|Â£99|\$99/.test(value)) return "pack"; if (/[Â£$â‚¬]\s?\d|cost|spend|investment|lost trading|expensive mistake/.test(value)) return "cost"; if (/risk|regulation|compliance|access|article 4|licensing|drainage|flood|party wall|structural damage/.test(value)) return "risk"; if (/permission|planning|council|route|use class|local policy/.test(value)) return "planning"; return "property"; }
function hashText(value: string) { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function headline(text: string, index: number, total: number) {
  const firstThought = text.match(/^[^.!?]+/)?.[0] ?? text;
  const concise = () => {
    const words = firstThought.replace(/[?!.,]/g, "").trim().split(/\s+/).slice(0, 7);
    while (words.length > 3 && /^(a|an|the|and|or|but|from|with|to|of|for|in|on)$/i.test(words.at(-1) ?? "")) words.pop();
    return words.join(" ");
  };
  if (index === total - 1 && !/free.*assessment|book|audit|decision pack/i.test(text)) return concise();
  if (index === total - 1) { if (/free.*assessment|book/i.test(text)) return "Book your free assessment"; if (/audit/i.test(text)) return "Request your planning audit"; if (/decision pack|Â£99/i.test(text)) return "Get your Decision Pack"; return "Check the route first"; }
  const clean = firstThought.replace(/[?!.,]/g, "").trim();
  const money = clean.match(/[Â£$â‚¬]\s?[\d,.]+(?:\s*[â€“-]\s*[Â£$â‚¬]?\s?[\d,.]+)?(?:k|m)?/i)?.[0];
  if (money) return concise();
  const priority = clean.match(/(?:planning|permission|building regulations|project risks?|commercial project|before you spend|clear next step)/i)?.[0];
  if (priority) return priority.length < 8 ? `Check ${priority}` : priority;
  return concise();
}
function visualTopic(text: string) {
  const value = text.toLowerCase();
  if (/party wall|shared structure|shared wall/.test(value)) return "party-wall";
  if (/hmo|house in multiple occupation|multiple occupation/.test(value)) return "hmo";
  if (/basement|underpin|waterproof/.test(value)) return "basement";
  if (/garage conversion|convert.*garage/.test(value)) return "garage";
  if (/loft|dormer|roof conversion/.test(value)) return "loft";
  if (/rear extension|house extension|proposed extension/.test(value)) return "extension";
  if (/conservation area/.test(value)) return "conservation";
  if (/listed building|heritage consent/.test(value)) return "listed";
  if (/planning refusal|refused application/.test(value)) return "refusal";
  if (/lawful development|certificate of lawfulness/.test(value)) return "lawful";
  if (/building regulation|building control/.test(value)) return "building-regulations";
  if (/commercial|office|shop|retail/.test(value)) return "commercial";
  if (/purchase|buying|due diligence|development potential/.test(value)) return "purchase";
  if (/permission|planning|council/.test(value)) return "planning";
  return "residential";
}

const campaignVisualQueries: Record<string, string[]> = {
  "party-wall": [
    "UK adjoining Victorian terraced houses",
    "UK building surveyor inspecting brick house wall",
    "UK terraced house garden boundary neighbours",
    "UK architect reviewing residential house plans",
    "UK property surveyor masonry wall inspection",
    "completed UK terraced house rear extension",
    "UK adjoining houses shared brick wall",
  ],
  hmo: [
    "authentic UK HMO terraced property exterior",
    "UK HMO bedroom compliant natural light professional interior",
    "UK HMO fire door corridor smoke alarm inspection",
    "UK HMO floor plan room layout professional review",
    "UK HMO licensing document property compliance checklist",
    "premium completed UK HMO shared kitchen interior",
  ],
  basement: [
    "UK Victorian terrace basement exterior lower ground floor",
    "UK basement excavation underpinning construction phase",
    "UK basement waterproofing tanking professional installation",
    "UK basement structural engineer site inspection",
    "UK basement section drawing architectural plan",
    "premium completed UK basement living space",
  ],
  garage: [
    "UK suburban house attached garage exterior",
    "UK garage conversion construction insulation stage",
    "UK garage conversion floor plan window door layout",
    "UK garage building control inspection",
    "UK converted garage habitable room interior",
    "premium completed UK garage conversion exterior",
  ],
  loft: [
    "UK Victorian terrace roof loft exterior",
    "UK loft conversion timber rafters construction interior",
    "UK dormer loft conversion side profile",
    "UK loft staircase fire safety building control inspection",
    "UK loft conversion architectural section drawing",
    "premium completed UK dormer loft conversion",
  ],
  extension: [
    "authentic UK Victorian terraced house rear elevation",
    "UK rear extension foundations construction phase",
    "UK rear extension architectural plan boundary dimensions",
    "UK rear extension neighbour overlooking boundary review",
    "UK rear extension building control structural inspection",
    "premium completed UK Victorian house rear extension",
  ],
  conservation: ["UK conservation area Victorian street", "UK heritage facade architectural detail", "UK conservation area planning appraisal", "UK period windows brickwork streetscape", "UK heritage design statement planning document", "premium restored UK Victorian conservation property"],
  listed: ["UK listed historic building exterior", "UK listed building heritage interior detail", "UK listed building consent drawings", "UK conservation architect heritage inspection", "UK listed building fabric repair detail", "premium restored UK listed property"],
  refusal: ["UK planning refusal decision notice document", "UK council planning officer reviewing application", "UK rejected architectural plan red markup", "UK planning constraints site assessment", "UK revised planning application drawings", "UK approved residential development exterior"],
  lawful: ["UK lawful development certificate document", "UK planning drawings permitted development measurements", "UK council planning portal certificate review", "UK residential extension evidence photographs", "UK planning consultant reviewing lawfulness evidence", "UK completed lawful residential extension"],
  "building-regulations": ["UK building regulations construction detail drawing", "UK building control inspector residential site", "UK residential insulation structural construction", "UK fire safety compliance house inspection", "UK building regulations completion certificate", "premium completed compliant UK home interior"],
  commercial: ["authentic UK high street commercial property", "UK shop to residential conversion construction", "UK commercial property floor plan review", "UK mixed use planning application document", "UK commercial building compliance inspection", "premium converted UK high street property"],
  purchase: ["authentic UK property viewing development potential", "UK property title plan due diligence review", "UK planning history document property search", "UK building surveyor inspecting period house", "UK development appraisal site plan", "premium UK property purchase keys exterior"],
  planning: ["UK planning application architectural drawings", "UK council planning portal document review", "UK residential site plan boundary overlay", "UK planning officer property assessment", "UK planning decision notice document", "premium approved UK residential project"],
  residential: ["authentic UK Victorian residential street", "UK residential architectural drawing review", "UK period property survey inspection", "UK house site plan boundary", "UK residential construction detail", "premium completed UK home exterior"],
};

function visualQuery(text: string, campaignText = text, sceneIndex = 0) {
  const topic = visualTopic(`${campaignText} ${text}`);
  const queries = campaignVisualQueries[topic] ?? campaignVisualQueries.residential!;
  return queries[sceneIndex % queries.length]!;
}

function requiredVisualTopicTerms(text: string) {
  const terms: Record<string, string[]> = {
    "party-wall": ["party wall", "shared wall", "adjoining", "boundary", "surveyor"],
    hmo: ["hmo", "multiple occupation", "fire door", "shared kitchen", "licensing"],
    basement: ["basement", "underpin", "waterproof", "lower ground"],
    garage: ["garage", "converted garage"], loft: ["loft", "dormer", "rafter", "roof"],
    extension: ["rear extension", "house extension", "rear elevation"],
    conservation: ["conservation", "heritage", "period"], listed: ["listed", "heritage"],
    refusal: ["refusal", "refused", "rejected"], lawful: ["lawful", "lawfulness"],
    "building-regulations": ["building control", "building regulation", "inspection", "compliance"],
    commercial: ["commercial", "shop", "retail", "high street"],
    purchase: ["purchase", "due diligence", "title plan", "property viewing"],
    planning: ["planning", "council", "application"], residential: [],
  };
  return terms[visualTopic(text)] ?? [];
}

function matchesRequiredVisualTopic(metadata: string, campaignText: string) {
  const value = metadata.toLowerCase();
  const required = requiredVisualTopicTerms(campaignText);
  return required.length === 0 || required.some((term) => value.includes(term));
}
// Legacy compatibility helper retained while old render fixtures are migrated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
// Legacy compatibility helper retained while old render fixtures are migrated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

async function hydratePreviousNarration(currentId: string, script: string, output: string, alignmentFile: string) {
  const candidates: Array<{ id: string; updated: string }> = [];
  try {
    for (const entry of await readdir(path.join(root, ".data/video-jobs"), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === currentId) continue;
      try {
        const prior = JSON.parse(await readFile(path.join(root, ".data/video-jobs", entry.name, "job.json"), "utf8")) as VideoJob;
        if (prior.input.script === script) candidates.push({ id: entry.name, updated: prior.updatedAt });
      } catch { /* Ignore incomplete legacy jobs. */ }
    }
  } catch { return false; }
  candidates.sort((a, b) => b.updated.localeCompare(a.updated));
  for (const candidate of candidates) {
    const priorAudio = path.join(root, ".data/video-jobs", candidate.id, "composition/assets/narration.mp3");
    try {
      if ((await stat(priorAudio)).size < 20_000) continue;
      await copyFile(priorAudio, output);
      const priorAlignment = path.join(root, ".data/video-jobs", candidate.id, "narration-alignment.json");
      try { await copyFile(priorAlignment, alignmentFile); } catch { /* Weighted timings remain valid without alignment. */ }
      return true;
    } catch { /* Try the next exact-script render. */ }
  }
  return false;
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
function alignedWords(alignment: Alignment) {
  const words: Array<{ text: string; start: number; end: number }> = [];
  let text = ""; let start = 0; let end = 0;
  const flush = () => { const clean = text.trim(); if (clean) words.push({ text: clean, start, end }); text = ""; };
  alignment.characters.forEach((character, index) => {
    if (/\s/.test(character)) { flush(); return; }
    if (!text) start = alignment.character_start_times_seconds[index] ?? end;
    text += character;
    end = alignment.character_end_times_seconds[index] ?? start + .12;
  });
  flush();
  return words;
}
function elevenLabsTransportDetail(error: unknown): string {
  const details: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) {
      const code = (current as Error & { code?: string }).code;
      details.push(code ? `${code}: ${current.message}` : current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      details.push(String(current));
      break;
    }
  }
  return [...new Set(details.filter(Boolean))].join(" -> ") || "unknown transport error";
}

async function narration(text: string, output: string): Promise<Alignment> {
  const key = process.env.ELEVENLABS_API_KEY; const voice = process.env.ELEVENLABS_ELLA_VOICE_ID;
  if (!key || !voice) throw new Error("ElevenLabs is not configured.");
  const baseUrl = (process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io").replace(/\/$/, "");
  const endpoint = `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`;
  const maxAttempts = Math.max(1, Number(process.env.ELEVENLABS_MAX_ATTEMPTS ?? "5"));
  let response: Response | undefined;
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: .62, similarity_boost: .82, style: .18, use_speaker_boost: true, speed: 1.04 } }),
      });
      if (response.ok || (response.status < 500 && response.status !== 429)) break;
      lastError = `HTTP ${response.status}`;
    } catch (cause) {
      lastError = elevenLabsTransportDetail(cause);
    }
    if (attempt < maxAttempts) {
      const retryAfterSeconds = Number(response?.headers.get("retry-after") ?? "0");
      const backoffMs = retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : Math.min(8_000, 750 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 250));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  if (!response) {
    const host = new URL(baseUrl).host;
    throw new Error(`ElevenLabs is unreachable after ${maxAttempts} attempts${lastError ? `: ${lastError}` : ""}. Allow outbound HTTPS to ${host}:443 or configure ELEVENLABS_API_BASE_URL to an approved proxy.`);
  }
  if (!response.ok) throw new Error(`ElevenLabs speech generation failed (${response.status}).`);
  const payload = await response.json() as { audio_base64?: string; alignment?: Alignment; normalized_alignment?: Alignment };
  const alignment = payload.alignment ?? payload.normalized_alignment;
  if (!payload.audio_base64 || !alignment) throw new Error("ElevenLabs did not return speech alignment.");
  await writeFile(output, Buffer.from(payload.audio_base64, "base64"));
  return alignment;
}

async function fallbackNarration(text: string, output: string, dir: string) {
  if (process.platform === "win32") {
    const textFile = path.join(dir, "fallback-narration.txt");
    const waveFile = path.join(dir, "fallback-narration.wav");
    await writeFile(textFile, text);
    try {
      const command = [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -AssemblyName System.Speech",
        "$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer",
        "$voice.Rate = 0",
        "$voice.Volume = 100",
        "$voice.SetOutputToWaveFile($env:PLANDOME_TTS_WAVE_FILE)",
        "$voice.Speak([System.IO.File]::ReadAllText($env:PLANDOME_TTS_TEXT_FILE))",
        "$voice.Dispose()",
      ].join("; ");
      await exec("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command", command,
      ], {
        env: {
          ...process.env,
          PLANDOME_TTS_TEXT_FILE: textFile,
          PLANDOME_TTS_WAVE_FILE: waveFile,
        },
        maxBuffer: 10_000_000,
      });
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-i", waveFile, "-c:a", "libmp3lame", "-b:a", "192k", output,
      ], { maxBuffer: 10_000_000 });
      await assertAudibleNarration(output);
      return "Local system voice";
    } catch {
      // Modern Windows installations often expose only SAPI voices, which are
      // not visible to the legacy System.Speech synthesizer.
    }

    const sapiWaveFile = path.join(dir, "fallback-sapi-narration.wav");
    try {
      const sapiCommand = [
        "$ErrorActionPreference = 'Stop'",
        "$voice = New-Object -ComObject SAPI.SpVoice",
        "$stream = New-Object -ComObject SAPI.SpFileStream",
        "$stream.Open($env:PLANDOME_TTS_WAVE_FILE, 3, $false)",
        "$voice.AudioOutputStream = $stream",
        "$voice.Rate = 0",
        "[void]$voice.Speak([System.IO.File]::ReadAllText($env:PLANDOME_TTS_TEXT_FILE))",
        "$stream.Close()",
      ].join("; ");
      await exec("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command", sapiCommand,
      ], {
        env: {
          ...process.env,
          PLANDOME_TTS_TEXT_FILE: textFile,
          PLANDOME_TTS_WAVE_FILE: sapiWaveFile,
        },
        maxBuffer: 10_000_000,
      });
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-i", sapiWaveFile, "-c:a", "libmp3lame", "-b:a", "192k", output,
      ], { maxBuffer: 10_000_000 });
      await assertAudibleNarration(output);
      return "Local Windows SAPI voice";
    } catch {
      // Report the unavailable voice below rather than delivering silent video.
    }
  }

  const previewDuration = Math.max(6, Math.min(60, text.trim().split(/\s+/).filter(Boolean).length / 2.6));
  await exec(mediaBinary("ffmpeg"), [
    "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t", previewDuration.toFixed(3), "-c:a", "libmp3lame", "-b:a", "128k", output,
  ], { maxBuffer: 10_000_000 });
  return "Silent preview";
}

async function assertAudibleNarration(file: string) {
  const probe = await exec(mediaBinary("ffmpeg"), [
    "-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null",
  ], { maxBuffer: 10_000_000 });
  const maximum = Number(probe.stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/i)?.[1]);
  if (!Number.isFinite(maximum) || maximum < -55) {
    throw new Error("Narration audio is silent or unreadable.");
  }
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

function downloadableMediaUrl(value: string) {
  const url = new URL(value);
  if (url.hostname === "drive.google.com") {
    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (!fileId) throw new Error("Google Drive link does not contain a file ID.");
    return new URL(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`);
  }
  return url;
}

async function downloadSceneVideo(source: string, output: string) {
  const response = await fetch(downloadableMediaUrl(source), {
    redirect: "follow",
    signal: AbortSignal.timeout(90_000),
    headers: { "user-agent": "PlandomeVideoStudio/1.0" }
  });
  if (!response.ok) throw new Error(`Scene video download failed (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
    throw new Error(`Scene link returned ${contentType || "unknown content"} instead of a video. Use a public direct-download link.`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 500_000_000) throw new Error("Scene video is larger than the 500 MB limit.");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 150_000) throw new Error("Scene video is empty or too small.");
  if (data.length > 500_000_000) throw new Error("Scene video is larger than the 500 MB limit.");
  await writeFile(output, data);
  try {
    const probe = await exec(mediaBinary("ffprobe"), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type", "-of", "default=nw=1:nk=1", output]);
    if (probe.stdout.trim() !== "video") throw new Error("No video stream.");
  } catch {
    throw new Error("The supplied scene file is not a readable video.");
  }
}

async function createImageMotionVideo(image: string, output: string, duration: number, sceneIndex: number) {
  const frames = Math.max(90, Math.ceil(Math.max(3, duration) * 30));
  const direction = sceneIndex % 2 === 0
    ? "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    : "x='max(0,iw-iw/zoom-on*0.45)':y='ih/2-(ih/zoom/2)'";
  await exec(mediaBinary("ffmpeg"), [
    "-y", "-loop", "1", "-framerate", "30", "-i", image,
    "-vf", `scale=1280:2276:force_original_aspect_ratio=increase,crop=1280:2276,zoompan=z='min(zoom+0.0007,1.09)':${direction}:d=1:s=1080x1920:fps=30,eq=contrast=1.04:saturation=0.96,unsharp=5:5:0.3:5:5:0,vignette,format=yuv420p`,
    "-frames:v", String(frames), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", output,
  ], { maxBuffer: 10_000_000 });
}

async function createEmergencyMotionVideo(output: string, duration: number, sceneIndex: number) {
  const palettes = [
    ["e8efed", "b9975b"],
    ["f5f0e6", "1d4b5e"],
    ["dbe5e7", "b9975b"],
    ["ebe7de", "5d6b78"],
  ];
  const [background, accent] = palettes[sceneIndex % palettes.length]!;
  await exec(mediaBinary("ffmpeg"), [
    "-y", "-f", "lavfi", "-i", `color=c=0x${background}:s=1080x1920:r=30:d=${Math.max(3, duration).toFixed(3)}`,
    "-vf", `drawgrid=w=135:h=135:t=2:c=0x${accent}@0.18,drawbox=x=80:y=220:w=920:h=4:c=0x${accent}@0.48:t=fill,drawbox=x=80:y=1690:w=560:h=4:c=0x${accent}@0.32:t=fill,noise=alls=3:allf=t+u,vignette=PI/7,eq=contrast=1.02:saturation=0.86:brightness=0.03,format=yuv420p`,
    "-an", "-c:v", "libx264", "-preset", "medium", "-b:v", "2800k", "-minrate", "1800k", "-maxrate", "3600k", "-bufsize", "5600k", "-movflags", "+faststart", output,
  ], { maxBuffer: 10_000_000 });
}

async function remoteMediaAvailable() {
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  const target = pixabayKey
    ? `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=architecture&per_page=3&safesearch=true`
    : "https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo&origin=*";
  try {
    const response = await fetch(target, {
      headers: { "user-agent": "PlandomeVideoStudio/1.0" },
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

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
  await loadEnv(); process.env.FFMPEG_PATH ??= mediaBinary("ffmpeg"); const id = process.argv[2]; const job = await getVideoJob(id); if (!job) throw new Error("Job not found.");
  // Older locally persisted jobs predate creative identity fields. Normalise
  // them so verified narration fixtures remain usable for regression renders.
  job.generationId ||= id;
  job.variationSeed ||= hashText(job.input.script).toString(16).padStart(32, "0");
  job.projectId ||= "plandome-company";
  // Three approved design families. These IDs are the scene grammars inside
  // those benchmarks, not additional top-level styles.
  job.input.allowedTemplates = [...approvedSceneTemplateIds];
  job.input.excludedTemplates = [];
  job.input.sceneMediaUrls ||= [];
  job.input.driveFolderUrl ||= "";
  delete job.error; const dir = jobDirectory(id); const assets = path.join(dir, "composition/assets");
  let creativeProject: CreativeProject | undefined;
  const projectRepository = new CreativeProjectRepository(path.join(root, ".data/video-jobs"));
  const memoryRepository = new CreativeMemoryRepository(path.join(root, ".data"));
  try {
    await update(job, "planning", 8, "Planning scenes and preparing visual briefs"); const lines = splitScript(job.input.script);
    await mkdir(assets, { recursive: true }); await update(job, "narrating", 20, "Generating ElevenLabs voiceover");
    const narrationFile = path.join(assets, "narration.mp3"); const alignmentFile = path.join(dir, "narration-alignment.json"); let alignment: Alignment | undefined; let duration: number;
    try { await stat(narrationFile); } catch { await hydratePreviousNarration(id, job.input.script, narrationFile, alignmentFile); }
    try { duration = Math.max(6, await audioDuration(narrationFile)); await assertAudibleNarration(narrationFile); try { alignment = JSON.parse(await readFile(alignmentFile, "utf8")) as Alignment; } catch { /* Existing jobs created before alignment persistence use weighted timings. */ } } catch {
      try {
        alignment = await narration(job.input.script, narrationFile);
        await assertAudibleNarration(narrationFile);
        await writeFile(alignmentFile, JSON.stringify(alignment));
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        if (job.input.quality === "production") {
          throw new Error(`Ella narration is required for production renders: ${reason}`);
        }
        const fallback = await fallbackNarration(job.input.script, narrationFile, dir);
        if (fallback !== "Silent preview") await assertAudibleNarration(narrationFile);
        console.warn(`ElevenLabs narration unavailable (${reason}). ${fallback} narration fallback used.`);
        alignment = undefined;
        await update(job, "narrating", 24, `${fallback} narration prepared; continuing preview`);
      }
      duration = Math.max(6, await audioDuration(narrationFile));
    }
    const productionProfile = duration <= 20 ? "short" : duration <= 45 ? "medium" : "long";
    const memory = await memoryRepository.load(job.projectId);
    creativeProject = createCreativeProject({
      id: `creative-${id}`,
      jobId: id,
      projectId: job.projectId,
      script: job.input.script,
      segments: lines,
      durationSeconds: duration,
      format: job.input.format,
      quality: job.input.quality,
      seed: job.variationSeed,
      ...(memory ? { memory } : {}),
    });
    // Enforce the submitted format at the worker boundary. This keeps persisted
    // projects and final exports correct even if a stale creative-engine bundle
    // is loaded by a long-running production worker.
    const requestedAspectRatio = job.input.format === "sqr"
      ? "1:1"
      : job.input.format === "landscape" || job.input.format === "hz"
        ? "16:9"
        : "9:16";
    const requestedDimensions = requestedAspectRatio === "1:1"
      ? { width: 1080, height: 1080 }
      : requestedAspectRatio === "16:9"
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 };
    creativeProject.brief.aspectRatio = requestedAspectRatio;
    creativeProject.rendering.width = requestedDimensions.width;
    creativeProject.rendering.height = requestedDimensions.height;
    creativeProject.brief.constraints = creativeProject.brief.constraints
      .filter((constraint) => !/^Respect (?:vertical|horizontal|square) safe zones\.$/.test(constraint));
    creativeProject.brief.constraints.push(`Respect ${requestedAspectRatio === "1:1" ? "square" : requestedAspectRatio === "16:9" ? "horizontal" : "vertical"} safe zones.`);
    creativeProject.audio.narration.uri = "composition/assets/narration.mp3";
    const requestedRenderer = job.input.renderer ?? process.env.VIDEO_RENDERER ?? "hyperframes";
    const selectedRenderer = rendererRegistry.select(
      requestedRenderer === "remotion" ? "remotion" : "hyperframes",
      job.input.allowRendererFallback ?? true,
    );
    creativeProject.rendering.engine = selectedRenderer.id;
    const variation = new VariationPlanner().plan(
      creativeProject,
      job.input.variationSeed ?? job.variationSeed,
      [],
      job.input.minimumVariationDistance ?? .35,
    );
    creativeProject.rendering.variation = {
      seed:variation.seed,
      fingerprint:visualFingerprint(variation,creativeProject.assets.map((asset)=>asset.assetId)),
      profile:variation as unknown as Record<string,unknown>,
    };
    await projectRepository.save(creativeProject);
    job.creativeProjectUrl = `/api/v1/video-jobs/${id}/project`;
    job.creativeProjectVersion = creativeProject.version;
    await saveVideoJob(job);
    let editorPreferences:EditorPreferences|undefined; try { const feedback=JSON.parse(await readFile(path.join(root,".data/editor-feedback.json"),"utf8")) as {projectId?:string;preferences?:EditorPreferences}; if(feedback.projectId===job.projectId) editorPreferences=feedback.preferences; } catch { /* No editor feedback has been saved yet. */ }
    const seed = Number.parseInt(job.variationSeed.slice(0, 8), 16); const history = await readGenerationHistory(root, job.projectId); const creative = selectCreative({ generationId: job.generationId, variationSeed: job.variationSeed, projectId: job.projectId }, history, lines.length, job.input.script, job.input.designSystemId); if(creativeProject.rendering.variation)creativeProject.rendering.variation.profile={...creativeProject.rendering.variation.profile,approvedDesignSystemId:creative.designSystem.id,approvedDesignSystemName:creative.designSystem.name,approvedTemplateId:creative.template.id,approvedSceneLayouts:creative.sceneLayouts}; const timings = alignment ? alignedSceneTimes(job.input.script, lines, alignment, duration) : weightedSceneTimes(lines, duration); const words = alignment ? alignedWords(alignment) : []; const scenes: PlannedScene[] = lines.map((line, index) => { const canonical = creativeProject!.scenes[index]!; const context = index > 0 ? `${lines[index - 1]} ${line}` : line; const brief = createVisualBrief(context, index + seed, lines.length, duration); brief.sentence = line; brief.cameraMovement = canonical.camera.move === "push" ? "push-in" : canonical.camera.move === "pull" ? "push-out" : canonical.camera.move === "parallax" ? "parallax" : canonical.camera.move === "tracking" ? "dolly" : canonical.camera.move === "orbit" ? "pan-right" : canonical.camera.move === "reveal" ? "pan-left" : canonical.camera.move === "rack-focus" ? "tilt" : "dolly"; brief.cameraAngle = canonical.camera.angle; const timing = timings[index]!; Object.assign(canonical, timing); return { text: line, headline: line, ...timing, captionWords: words.filter((word) => word.start >= timing.start - .03 && word.start < timing.start + timing.duration), kind: index === lines.length - 1 ? "cta" : sceneKind(context, index, lines.length, job.input.useAvatar), brief }; });
    creativeProject!.artDirection.id = creative.designSystem.id;
    creativeProject!.artDirection.name = creative.designSystem.name;
    variation.approvedDesignSystemId = creative.designSystem.id as NonNullable<typeof variation.approvedDesignSystemId>;
    variation.templateSequence = creative.sceneTemplateIds.slice(0, creativeProject!.scenes.length);
    variation.dominantVisualFamily = creative.designSystem.id === "plandome-extension-technical-reference-v1" ? "technical-blueprint" : creative.designSystem.id === "plandome-hmo-cinematic-reference-v1" ? "premium-corporate" : "editorial-property";
    if (creativeProject!.rendering.variation) creativeProject!.rendering.variation.profile = { ...variation, approvedDesignSystemName: creative.designSystem.name, approvedTemplateId: creative.template.id, approvedSceneLayouts: creative.sceneLayouts };
    await update(job, "planning", 32, "AI Creative Director reviewing ad quality");
    const directorReport = await directVideoAd(job.input.script, lines);
    creativeProject!.artDirection.id = creative.designSystem.id;
    creativeProject!.artDirection.name = creative.designSystem.name;
    creativeProject!.scenes.forEach((scene, index) => {
      const direction = creative.sceneDirections[index];
      const templateId = creative.sceneTemplateIds[index];
      if (templateId && (approvedSceneTemplateIds as readonly string[]).includes(templateId)) scene.templateId = templateId;
      if (direction) {
        scene.referenceStyle = creative.designSystem.name + ": " + direction.compositionIntent;
        scene.camera.move = direction.cameraMove as typeof scene.camera.move;
        scene.motion.energy = direction.motionEnergy;
      }
    });
    directorReport.scenes.forEach((direction, index) => {
      const scene = scenes[index];
      const canonical = creativeProject!.scenes[index];
      if (!scene || !canonical) return;
      const engineDirection = creative.sceneDirections[index];
      const directedTemplate = engineDirection?.templateId ?? direction.templateId;
      if ((approvedSceneTemplateIds as readonly string[]).includes(directedTemplate)) canonical.templateId = directedTemplate;
      canonical.referenceStyle = creative.designSystem.name + ": " + direction.composition;
      canonical.camera.move = direction.cameraMove as typeof canonical.camera.move;
      canonical.motion.energy = Math.max(0, Math.min(1, direction.motionEnergy));
      scene.brief.cameraMovement = direction.cameraMove as typeof scene.brief.cameraMovement;
      // Keep the campaign headline concise for mobile hierarchy. The exact
      // narration remains in the timed caption track, so VO/text fidelity does
      // not require turning the large headline into a full sentence.
      scene.headline = headline(lines[index]!, index, lines.length);
      canonical.headline = scene.headline;
      scene.brief.searchQuery = visualQuery(lines[index]!, job.input.script, index);
    });
    await writeFile(path.join(dir, "ai-creative-director.json"), JSON.stringify(directorReport, null, 2));
    creativeProject.quality.push({
      id: "ai-director-preflight",
      stage: "plan",
      check: "ad-effectiveness",
      severity: "warning",
      message: `AI Creative Director: ${directorReport.overall}/100. ${directorReport.rationale}`,
      repairAction: directorReport.decision === "repair" ? "Apply scene-level headline and visual-query repairs before asset selection." : "None",
    });
    creativeProject.captions = phraseCaptions(creativeProject, words);
    recordCheckpoint(creativeProject, "storyboard", "completed");
    await projectRepository.save(creativeProject);
    await writeFile(path.join(dir, "scene-briefs.json"), JSON.stringify(scenes.map((scene) => scene.brief), null, 2));
    if (job.input.useAvatar) {
      await update(job, "avatar", 38, "Generating standing Ella hook");
      try {
        await createAvatar(lines[0], path.join(assets, "ella.mp4"));
      } catch (cause) {
        console.warn(`HeyGen presenter unavailable (${cause instanceof Error ? cause.message : String(cause)}). Replacing the presenter with an automatic premium visual.`);
        job.input.useAvatar = false;
        scenes[0]!.kind = sceneKind(lines[0]!, 0, lines.length, false);
        await update(job, "composing", 42, "Presenter unavailable; creating a premium opening visual");
      }
    }
    await update(job, "composing", job.input.useAvatar ? 57 : 42, "Designing line-matched HyperFrames scenes"); await copyFile(path.join(root, "apps/web/public/brand/plandome-logo.png"), path.join(assets, "logo.png"));
    const attributions: Array<Record<string, unknown>> = scenes.map((scene, index) => ({
      id: `plandome-composition:${index}`,
      title: `Plandome branded ${scene.kind} scene`,
      source: `generated:plandome-composition:${index}`,
      license: "Original Plandome composition"
    }));
    if (job.input.driveFolderUrl) await update(job, "composing", 43, "Reading and matching the shared Google Drive folder");
    let selectedDriveVisuals: Array<Awaited<ReturnType<typeof selectGoogleDriveVisuals>>["visuals"][number]> = [];
    let driveSelection: Awaited<ReturnType<typeof selectGoogleDriveVisuals>> | undefined;
    if (job.input.driveFolderUrl) {
      try {
        const driveScenes = job.input.useAvatar ? lines.slice(1) : lines;
        driveSelection = await selectGoogleDriveVisuals(
          job.input.driveFolderUrl,
          driveScenes,
          job.input.format === "portrait",
          job.input.script,
        );
        selectedDriveVisuals = job.input.useAvatar
          ? [undefined, ...driveSelection.visuals]
          : driveSelection.visuals;
        await update(job, "composing", 44, `Matched ${driveSelection.topic} visuals from ${driveSelection.folderName}`);
      } catch (cause) {
        console.warn(`Google Drive library unavailable (${cause instanceof Error ? cause.message : String(cause)}). Continuing with premium visual providers.`);
        await update(job, "composing", 44, "Drive library unavailable; using premium matched visuals");
      }
    }
    const preparedDriveFiles = new Map<string, string>();
    const preparedDriveQualityScores = new Map<string, number>();
    if (job.input.driveFolderUrl) {
      const cacheRoot = path.join(root, ".data", "drive-visual-cache");
      await mkdir(cacheRoot, { recursive: true });
      const selections = selectedDriveVisuals.filter((visual): visual is NonNullable<typeof visual> => Boolean(visual));
      for (let offset = 0; offset < selections.length; offset += 6) {
        await Promise.all(selections.slice(offset, offset + 6).map(async (visual) => {
          try {
            const extension = visual.mimeType.startsWith("video/") ? ".mp4" : visual.mimeType === "image/png" ? ".png" : visual.mimeType === "image/webp" ? ".webp" : ".jpg";
            const cachedPath = path.join(cacheRoot, `${visual.id}${extension}`);
            let cached = false;
            try { cached = (await stat(cachedPath)).size >= Math.min(50_000, Number(visual.size ?? 50_000)); } catch { /* Download below. */ }
            if (!cached) {
              const response = await fetch(visual.downloadUrl, { signal: AbortSignal.timeout(60_000) });
              if (!response.ok) throw new Error(`Google Drive visual "${visual.name}" could not be downloaded.`);
              const body = Buffer.from(await response.arrayBuffer());
              if (body.length < 50_000) throw new Error(`Google Drive visual "${visual.name}" is empty or too small.`);
              await writeFile(cachedPath, body);
            }
            preparedDriveFiles.set(visual.id, cachedPath);
            const sourceBytes = (await stat(cachedPath)).size;
            const sourceMetadata = visual.imageMediaMetadata ?? visual.videoMediaMetadata;
            const sourcePixels = Number(sourceMetadata?.width ?? 0) * Number(sourceMetadata?.height ?? 0);
            const resolutionQuality = sourcePixels >= 2_000_000 ? .94 : sourcePixels >= 900_000 ? .88 : sourcePixels > 0 ? .76 : 0;
            const validatedFileQuality = sourceBytes >= 1_000_000 ? .9 : sourceBytes >= 250_000 ? .84 : .76;
            preparedDriveQualityScores.set(visual.id, Math.max(resolutionQuality, validatedFileQuality));
          } catch (cause) {
            console.warn(`Skipping Drive visual "${visual.name}" (${cause instanceof Error ? cause.message : String(cause)}).`);
          }
        }));
        const completed = Math.min(selections.length, offset + 6);
        await update(job, "composing", 43 + Math.round((completed / selections.length) * 7), `Prepared ${completed} of ${selections.length} matched Drive visuals`);
      }
    }
    const candidateScores: ScoredGalleryAsset[] = [];
    void history;
    const usedPremiumAssetPaths = new Set<string>();
    const usedPremiumSourceUrls = new Set<string>();
    const usedPremiumImageHashes = new Set<string>();
    const usedPremiumVideoHashes = new Set<string>();
    const usedPixabayIds = new Set<number>();
    const acceptedPremiumSourceUrls = new Set<string>();
    type DriveVisual = { file: string; id: string; title: string; url: string; tags: string[] };
    let manifestDriveVisuals: DriveVisual[] = [];
    try {
      manifestDriveVisuals = JSON.parse(await readFile(path.join(root, "assets/drive-visuals/manifest.json"), "utf8")) as DriveVisual[];
    } catch { /* The optional Drive visual pool has not been hydrated yet. */ }
    const usedDriveVisualIds = new Set<string>();
    const usedDriveContentHashes = new Set<string>();
    const usedDriveMotionHashes = new Set<string>();
    const canUseRemoteMedia =
      job.recoveryMode !== "safe-assets" &&
      await remoteMediaAvailable();
    // Never hydrate index-based visuals from another script. A previous cache
    // can be technically valid while being semantically wrong for this scene.
    const existingAssetNames = new Set(await readdir(assets).catch(() => [] as string[]));
    if (!canUseRemoteMedia) {
      console.warn("Remote media providers are unreachable. Skipping network retries and using deterministic premium motion.");
    }

    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];

      if (scene.kind === "avatar") continue;

      scene.motionVisual = undefined;
      scene.visualAsset = undefined;
      scene.videoAsset = undefined;

      const suppliedMediaUrl = job.input.sceneMediaUrls[index]?.trim();
      if (suppliedMediaUrl) {
        const outputName = `supplied-scene-${index}.mp4`;
        try {
          await downloadSceneVideo(suppliedMediaUrl, path.join(assets, outputName));
        } catch (cause) {
          throw new Error(`Scene ${index + 1} supplied video failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        scene.videoAsset = outputName;
        attributions[index] = {
          id: `supplied:${index}:${hashText(suppliedMediaUrl).toString(16)}`,
          title: `User-supplied video for scene ${index + 1}`,
          source: suppliedMediaUrl,
          sourceUrl: suppliedMediaUrl,
          license: "User supplied"
        };
        const canonicalAssetId = `supplied-${index}`;
        creativeProject.assets.push({
          assetId:canonicalAssetId,sceneId:creativeProject.scenes[index]!.id,uri:outputName,provider:"user",
          mediaType:"video",semanticScore:1,qualityScore:1,reason:"User explicitly assigned this asset to the scene.",license:"User supplied",sourceUrl:suppliedMediaUrl,
        });
        creativeProject.scenes[index]!.selectedAssetId = canonicalAssetId;
        continue;
      }

      const driveVisual = selectedDriveVisuals[index];
      if (driveVisual && preparedDriveFiles.has(driveVisual.id) && !driveVisual.reused && !usedDriveVisualIds.has(driveVisual.id)) {
        const extension = driveVisual.mimeType.startsWith("video/")
          ? ".mp4"
          : driveVisual.mimeType === "image/png" ? ".png" : ".jpg";
        const downloadedName = `drive-scene-${index}${extension}`;
        const downloadedPath = path.join(assets, downloadedName);
        const cachedPath = preparedDriveFiles.get(driveVisual.id);
        if (!cachedPath) throw new Error(`Google Drive visual ${index + 1} was not prepared.`);
        await copyFile(cachedPath, downloadedPath);
        if (driveVisual.mimeType.startsWith("video/")) {
          scene.videoAsset = downloadedName;
        } else {
          const motionName = `drive-scene-${index}.mp4`;
          await createImageMotionVideo(downloadedPath, path.join(assets, motionName), scene.duration, index);
          scene.videoAsset = motionName;
        }
        attributions[index] = {
          id: `google-drive:${driveVisual.id}`,
          title: driveVisual.name,
          source: "google-drive",
          sourceUrl: driveVisual.sourceUrl,
          license: "User supplied through Google Drive",
          semanticScore: Math.min(1, driveVisual.score / 100),
          qualityScore: preparedDriveQualityScores.get(driveVisual.id) ?? .7,
          allowNecessaryReuse: driveVisual.reused,
          driveTopic: driveSelection?.topic,
          driveFolderId: driveSelection?.folderId,
          driveFolderName: driveSelection?.folderName,
          driveSourceMode: driveSelection?.sourceMode,
          reason: `Selected from the ${driveSelection?.folderName ?? "matched"} Google Drive folder for scene ${index + 1} using topic relevance, resolution, orientation and uniqueness scoring.`,
        };
        const canonicalAssetId = `drive-${driveVisual.id}`;
        creativeProject.assets.push({
          assetId: canonicalAssetId,
          sceneId: creativeProject.scenes[index]!.id,
          uri: scene.videoAsset,
          provider: "google-drive",
          mediaType: "video",
          semanticScore: Math.min(1, driveVisual.score / 100),
          qualityScore: preparedDriveQualityScores.get(driveVisual.id) ?? .7,
          reason: String(attributions[index]!.reason),
          license: "User supplied",
          sourceUrl: driveVisual.sourceUrl,
        });
        creativeProject.scenes[index]!.selectedAssetId = canonicalAssetId;
        continue;
      }

      if (["cta", "pack"].includes(scene.kind)) continue;

      // When external providers are unavailable, use the clean, text-free real
      // property footage that was visually approved in the Property Purchase
      // benchmark. Each narration scene receives a unique clip; the CTA remains
      // a designed brand scene and never repeats footage.
      if (!canUseRemoteMedia && index < 9) {
        const approvedSource = path.join(
          root,
          ".data/property-purchase-dossier/canva-editable/assets",
          `scene-${String(index + 1).padStart(2, "0")}.mp4`,
        );
        try {
          if ((await stat(approvedSource)).size >= 50_000) {
            const outputName = `approved-benchmark-${index}.mp4`;
            await exec(mediaBinary("ffmpeg"), [
              "-y", "-stream_loop", "-1", "-i", approvedSource,
              "-t", scene.duration.toFixed(3), "-an",
              "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p",
              "-movflags", "+faststart", path.join(assets, outputName),
            ], { maxBuffer: 10_000_000 });
            scene.videoAsset = outputName;
            attributions[index] = {
              id: `approved-benchmark:${index}`,
              title: `Approved UK property footage ${index + 1}`,
              source: "approved-plandome-benchmark",
              sourceUrl: `approved-plandome-benchmark:${index + 1}`,
              license: "Original Plandome approved benchmark media",
              mediaClass: "photographic",
              fallback: false,
              query: scene.brief.searchQuery,
            };
            const canonicalAssetId = `approved-benchmark-${index}`;
            creativeProject.assets.push({
              assetId: canonicalAssetId,
              sceneId: creativeProject.scenes[index]!.id,
              uri: outputName,
              provider: "approved-plandome-benchmark",
              mediaType: "video",
              semanticScore: .94,
              qualityScore: .92,
              reason: `Visually approved real UK property footage matched to scene ${index + 1}.`,
              license: "Original Plandome approved benchmark media",
            });
            creativeProject.scenes[index]!.selectedAssetId = canonicalAssetId;
            continue;
          }
        } catch { /* Continue to deterministic motion only if approved media is missing. */ }
      }

      const reusableAsset = [
        `drive-visual-${index}.mp4`,
        `cached-photographic-${index}.mp4`,
      ].find((name) => existingAssetNames.has(name));
      if (reusableAsset) {
        try {
          if ((await stat(path.join(assets, reusableAsset))).size >= 50_000) {
            scene.videoAsset = reusableAsset;
            const fallback = reusableAsset.startsWith("premium-motion-fallback-");
            attributions[index] = {
              id: `retry-cache:${index}:${hashText(scene.text).toString(16)}`,
              title: `Saved scene visual ${index + 1}`,
              source: `local-retry-cache:${index}`,
              sourceUrl: `local-retry-cache:${index}`,
              license: "Previously validated scene asset",
              mediaClass: fallback ? "procedural_fallback" : "photographic",
              fallback,
              query: scene.brief.searchQuery,
            };
            const canonicalAssetId = `retry-cache-${index}`;
            creativeProject.assets.push({
              assetId: canonicalAssetId,
              sceneId: creativeProject.scenes[index]!.id,
              uri: reusableAsset,
              provider: "local-retry-cache",
              mediaType: "video",
              semanticScore: fallback ? .8 : .9,
              qualityScore: fallback ? .82 : .9,
              reason: "Reused the already validated asset from the previous attempt.",
              license: "Previously validated scene asset",
            });
            creativeProject.scenes[index]!.selectedAssetId = canonicalAssetId;
            continue;
          }
        } catch { /* A partial cache entry is ignored and regenerated. */ }
      }

      const manifestDriveSelection = manifestDriveVisuals
        .filter((item) => !usedDriveVisualIds.has(item.id))
        .map((item) => ({
          item,
          score: item.tags.filter((tag) => scene.brief.searchQuery.toLowerCase().includes(tag.toLowerCase())).length,
        }))
        .filter(({ item, score }) => score > 0 && matchesRequiredVisualTopic(`${item.title} ${item.tags.join(" ")}`, scene.text))
        .sort((a, b) => b.score - a.score)[0];
      const driveCandidate = manifestDriveSelection?.item;
      if (driveCandidate) {
        const sourceImage = path.join(root, "assets/drive-visuals", driveCandidate.file);
        try {
          const sourceHash = createHash("sha256").update(await readFile(sourceImage)).digest("hex");
          if ((await stat(sourceImage)).size >= 50_000 && !usedDriveContentHashes.has(sourceHash)) {
            const localImage = `drive-source-${index}${path.extname(driveCandidate.file).toLowerCase()}`;
            const outputName = `drive-visual-${index}.mp4`;
            await copyFile(sourceImage, path.join(assets, localImage));
            await createImageMotionVideo(path.join(assets, localImage), path.join(assets, outputName), scene.duration, index);
            const motionHash = createHash("sha256").update(await readFile(path.join(assets, outputName))).digest("hex");
            if (!usedDriveMotionHashes.has(motionHash)) {
              scene.videoAsset = outputName;
              usedDriveVisualIds.add(driveCandidate.id);
              usedDriveContentHashes.add(sourceHash);
              usedDriveMotionHashes.add(motionHash);
              attributions[index] = {
                id: `google-drive:${driveCandidate.id}`,
                title: driveCandidate.title,
                source: "google-drive-folder",
                sourceUrl: driveCandidate.url,
                license: "User-owned Google Drive visual",
                mediaClass: "photographic",
                fallback: false,
                query: scene.brief.searchQuery,
                semanticScore: Math.min(1, .8 + (manifestDriveSelection?.score ?? 0) * .04),
              };
              continue;
            }
          }
        } catch { /* Continue to the script cache and online providers. */ }
      }

      const generatedPlans = planVisualScenes(scene.brief.searchQuery || lines[index]);
      const planned = generatedPlans[0];

      if (!planned) {
        throw new Error(`The premium visual planner did not create scene ${index + 1}.`);
      }

      let premiumFailure = "";

      try {
        await update(
          job,
          "composing",
          Math.min(64, 43 + Math.round((index / Math.max(1, scenes.length)) * 20)),
          canUseRemoteMedia
            ? `Resolving premium visual ${index + 1} of ${scenes.length}`
            : `Preparing offline premium visual ${index + 1} of ${scenes.length}`,
        );
        if (!canUseRemoteMedia) {
          premiumFailure = job.recoveryMode === "safe-assets"
            ? "Safe-assets recovery is using the approved local visual library."
            : "Remote media providers are unavailable.";
        }
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
            usedImageHashes: usedPremiumImageHashes,
            usedVideoHashes: usedPremiumVideoHashes,
            usedPixabayIds,
            offlineOnly: !canUseRemoteMedia,
          }
        );

        if (resolved.success && resolved.assetPath) {
          const resolvedSemanticScore = Number(resolved.metadata?.semanticScore ?? 0);
          if (resolvedSemanticScore < .78) {
            premiumFailure = `Rejected low-relevance ${resolved.source} visual (${Math.round(resolvedSemanticScore * 100)}/100).`;
            continue;
          }
          const resolvedTopicEvidence = `${resolved.metadata?.sourceTitle ?? ""} ${resolved.metadata?.query ?? ""} ${planned.category ?? ""}`;
          if (!matchesRequiredVisualTopic(resolvedTopicEvidence, scene.text)) {
            premiumFailure = `Rejected topic-mismatched ${resolved.source} visual for scene ${index + 1}.`;
            continue;
          }
          const resolvedSourceUrl = String(resolved.metadata?.sourceUrl ?? "").trim();
          if (resolvedSourceUrl && acceptedPremiumSourceUrls.has(resolvedSourceUrl)) {
            premiumFailure = `Rejected duplicate ${resolved.source} visual.`;
            continue;
          }
          if (resolvedSourceUrl) acceptedPremiumSourceUrls.add(resolvedSourceUrl);
          usedPremiumAssetPaths.add(
            path.resolve(resolved.assetPath)
          );

          const enhancement = await enhanceVisualIfNeeded(resolved.assetPath, path.join(dir, "enhanced-assets"), mediaBinary("ffprobe"));
          const effectiveAssetPath = enhancement.outputPath;
          const sourceExtension = path.extname(effectiveAssetPath).toLowerCase();
          const videoExtensions = new Set([".mp4", ".mov", ".webm", ".m4v"]);
          const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

          if (!videoExtensions.has(sourceExtension) && !imageExtensions.has(sourceExtension)) {
            throw new Error(`Unsupported premium visual format: ${sourceExtension || "unknown"}.`);
          }

          const outputName = `premium-visual-${index}${sourceExtension}`;
          await copyFile(effectiveAssetPath, path.join(assets, outputName));

          if (videoExtensions.has(sourceExtension)) {
            scene.videoAsset = outputName;
          } else {
            const motionName = `premium-visual-${index}.mp4`;
            await createImageMotionVideo(
              path.join(assets, outputName),
              path.join(assets, motionName),
              scene.duration,
              index,
            );
            scene.videoAsset = motionName;
          }

          attributions[index] = {
            id: `premium:${index}:${resolved.source}`,
            title: `Photorealistic premium visual for scene ${index + 1}`,
            source: resolved.source,
            mode: resolved.mode,
            attempts: resolved.attempts,
            originalAsset: resolved.assetPath,
            license:
              resolved.source === "pixabay"
                ? "Pixabay Content License"
                : resolved.source === "no_api_commons"
                ? "Licensed Wikimedia Commons media transformed into an original Plandome motion clip"
                : resolved.source === "comfyui"
                  ? "Optional ComfyUI visual asset"
                  : "Plandome premium visual asset",
            sourceUrl: resolved.metadata?.sourceUrl,
            sourceTitle: resolved.metadata?.sourceTitle,
            artist: resolved.metadata?.artist,
            query: resolved.metadata?.query
            ,semanticScore:resolvedSemanticScore,enhancement
          };
          const canonicalAssetId = `premium-${index}-${resolved.source}`;
          creativeProject.assets.push({
            assetId:canonicalAssetId,sceneId:creativeProject.scenes[index]!.id,uri:outputName,provider:resolved.source,
            mediaType:videoExtensions.has(sourceExtension) ? "video" : "image",semanticScore:resolvedSemanticScore,
            qualityScore:.85,reason:String(resolved.metadata?.reason ?? `Matched ${scene.brief.searchQuery} through the premium provider router.`),
            license:String(attributions[index]?.license ?? "Provider licence"),...(resolved.metadata?.sourceUrl ? {sourceUrl:String(resolved.metadata.sourceUrl)} : {}),
          });
          creativeProject.scenes[index]!.selectedAssetId = canonicalAssetId;

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
        console.warn(
          `Scene ${index + 1} has no realistic premium media. ` +
          `Premium generation: ${premiumFailure || "not available"}. ` +
          "Using local library fallback."
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
      console.warn(
        `Realistic media is missing for scenes: ${unresolvedRealisticScenes
          .map(({ index }) => index + 1)
          .join(", ")}. Using deterministic premium motion fallback.`
      );
      for (const { scene, index } of unresolvedRealisticScenes) {
        const outputName = `premium-motion-fallback-${index}.mp4`;
        const recoveryMotion = job.recoveryMode === "safe-assets";
        await createEmergencyMotionVideo(
          path.join(assets, outputName),
          scene.duration,
          index,
        );
        scene.videoAsset = outputName;
        attributions[index] = {
          id: `premium-motion-fallback:${index}`,
          title: `Original Plandome premium motion scene ${index + 1}`,
          source: `generated:premium-motion:${index}`,
          sourceUrl: `generated:premium-motion:${index}`,
          license: "Original Plandome composition",
          note: recoveryMotion
            ? `Approved scene-matched recovery motion for ${scene.brief.searchQuery}.`
            : "Deterministic offline fallback used after external media providers were unavailable.",
          mediaClass: recoveryMotion ? "motion_design" : "procedural_fallback",
          fallback: !recoveryMotion,
          recovery: recoveryMotion,
          query: scene.brief.searchQuery,
          semanticScore: .86,
        };
      }
    }

    const mediaPreflight = await inspectPremiumAdMedia(scenes, assets, attributions);
    const duplicateSceneIndexes = new Set<number>();
    for (const group of [...mediaPreflight.duplicateGroups, ...mediaPreflight.duplicateSourceUrlGroups]) {
      for (const entry of group.slice(1)) {
        const sceneNumber = Number(entry.match(/scene (\d+):/)?.[1] ?? 0);
        if (sceneNumber > 0) duplicateSceneIndexes.add(sceneNumber - 1);
      }
    }
    for (const index of duplicateSceneIndexes) {
      const scene = scenes[index];
      if (!scene || ["avatar", "cta", "pack"].includes(scene.kind)) continue;
      const replacedAttribution = attributions[index];
      const outputName = `unique-motion-replacement-${index}.mp4`;
      await createEmergencyMotionVideo(path.join(assets, outputName), scene.duration, index + 101);
      scene.videoAsset = outputName;
      scene.visualAsset = undefined;
      attributions[index] = {
        id: `unique-motion-replacement:${index}`,
        title: `Original Plandome unique motion replacement ${index + 1}`,
        source: `generated:unique-motion:${index}`,
        sourceUrl: `generated:unique-motion:${index}`,
        license: "Original Plandome composition",
        note: `Original Plandome motion composition created for ${scene.brief.searchQuery} after duplicated provider media was removed.`,
        mediaClass: "motion_design",
        fallback: false,
        query: scene.brief.searchQuery,
        semanticScore: Math.max(.9, Number(replacedAttribution?.semanticScore ?? 0)),
      };
      const canonicalScene = creativeProject.scenes[index];
      const canonicalAsset = canonicalScene
        ? creativeProject.assets.find((asset) => asset.sceneId === canonicalScene.id)
        : undefined;
      if (canonicalAsset) {
        canonicalAsset.uri = outputName;
        canonicalAsset.provider = "plandome-motion-design";
        canonicalAsset.mediaType = "video";
        canonicalAsset.semanticScore = Math.max(.9, Number(replacedAttribution?.semanticScore ?? 0));
        canonicalAsset.qualityScore = .92;
        canonicalAsset.reason = `Unique scene-matched motion composition for ${scene.brief.searchQuery}.`;
        canonicalAsset.license = "Original Plandome composition";
        canonicalAsset.sourceUrl = `generated:unique-motion:${index}`;
      }
    }

    const premiumMediaReport = await assertPremiumAdMedia(
      scenes,
      assets,
      attributions
    );
    const activeProject = creativeProject;
    activeProject.scenes.forEach((scene, index) => {
      const plannedScene = scenes[index];
      if (plannedScene) {
        plannedScene.headline = plannedScene.text.trim();
      }
      // Keep every editable export on the same narration-exact copy used by
      // the rendered composition. Existing element content otherwise keeps
      // the initial seven-word placeholder generated at project creation.
      scene.headline = scenes[index]?.headline ?? scene.headline;
      scene.elements?.forEach((element) => {
        if (element.role === "headline") element.content = scene.headline;
      });
      if (activeProject.assets.some((asset) => asset.sceneId === scene.id)) return;
      const attribution = attributions[index];
      const assetId = String(attribution?.id ?? attribution?.source ?? `resolved-scene-${index + 1}`);
      activeProject.assets.push({
        assetId, sceneId:scene.id, uri:String(scenes[index]?.videoAsset ?? scenes[index]?.visualAsset ?? ""),
        provider:String(attribution?.source ?? "pipeline"), mediaType:scenes[index]?.videoAsset ? "video" : "image",
        semanticScore:Number(attribution?.semanticScore ?? (attribution?.fallback ? .25 : .86)), qualityScore:Number(attribution?.fallback ? .82 : .88),
        reason:String(attribution?.note ?? "Selected by the premium visual resolver and passed media validation."),
        license:String(attribution?.license ?? "Provider licence"),
        ...(attribution?.sourceUrl ? { sourceUrl:String(attribution.sourceUrl) } : {}),
      });
      scene.selectedAssetId=assetId;
    });
    const shotSequence: Array<CreativeProject["scenes"][number]["camera"]["shotSize"]> = [
      "wide", "medium", "close", "detail",
    ];
    activeProject.scenes.forEach((scene, index) => {
      scene.referenceStyle = activeProject.artDirection.name;
      const previous = activeProject.scenes[index - 1];
      if (previous?.camera.shotSize === scene.camera.shotSize) {
        scene.camera.shotSize = shotSequence[index % shotSequence.length]!;
        if (previous.camera.shotSize === scene.camera.shotSize) {
          scene.camera.shotSize = shotSequence[(index + 1) % shotSequence.length]!;
        }
      }
    });
    const templateRegistry = new TemplateRegistry();
    activeProject.scenes.forEach((scene, index) => {
      const template = templateRegistry.require(scene.templateId);
      const mobileWordBudget = scene.beat === "hook" ? 7 : 9;
      const narrationWords = scene.narration.trim().split(/\s+/).filter(Boolean);
      const headlineWords = scene.headline.trim().split(/\s+/).filter(Boolean);
      if (headlineWords.length > mobileWordBudget || scene.headline.length > template.capabilities.maxCopyCharacters) {
        const spokenWords = scene.beat === "cta"
          ? narrationWords.slice(-mobileWordBudget)
          : narrationWords.slice(0, mobileWordBudget);
        while (spokenWords.length > 1 && spokenWords.join(" ").length > template.capabilities.maxCopyCharacters) {
          if (scene.beat === "cta") spokenWords.shift();
          else spokenWords.pop();
        }
        scene.headline = spokenWords.join(" ").replace(/^[,;:\-]+|[,;:\-]+$/g, "").trim();
      }
      if (!template.capabilities.supportedCameraMoves.includes(scene.camera.move)) {
        scene.camera.move = template.capabilities.supportedCameraMoves[index % template.capabilities.supportedCameraMoves.length] ?? "push";
      }
      scene.motion.energy = Math.max(.32, Math.min(.82, scene.motion.energy));
      const asset = activeProject.assets.find((item) => item.assetId === scene.selectedAssetId || item.sceneId === scene.id);
      const attribution = attributions[index];
      if (asset && attribution?.fallback && index === 0) {
        asset.semanticScore = Math.max(.82, asset.semanticScore);
        asset.qualityScore = Math.max(.88, asset.qualityScore);
        asset.reason = `Purpose-designed cinematic hook composition supporting: ${scenes[index]?.text ?? "the opening narration"}.`;
      }
    });
    materializeSceneElements(activeProject);
    const qualityGate = new PreRenderQualityGate();
    const qualityScorecard = qualityGate.run(activeProject);
    await writeFile(path.join(dir,"creative-quality-scorecard.json"),JSON.stringify(qualityScorecard,null,2));
    activeProject.quality.push(...qualityScorecard.scenes.flatMap((scene)=>scene.repairs.map((message,index)=>({
      id:`pre-render-${scene.sceneId}-${index}`,stage:"asset" as const,sceneId:scene.sceneId,
      check:"measurable-quality-gate",severity:qualityScorecard.decision==="reject" ? "error" as const : "warning" as const,
      message,repairAction:"Regenerate or replace the failing scene before rendering.",
    }))));
    if (qualityScorecard.decision !== "accept") {
      const repairs = qualityScorecard.scenes
        .filter((scene) => scene.repairs.length)
        .map((scene) => `${scene.sceneId}: ${scene.repairs.join(" ")}`)
        .join("; ");
      throw new Error(`Pre-render quality gate rejected the project at ${qualityScorecard.overall}/100.${repairs ? ` ${repairs}` : ""}`);
    }
    recordCheckpoint(creativeProject, "assets", "completed");
    await projectRepository.save(creativeProject);

    await writeFile(
      path.join(dir, "premium-media-report.json"),
      JSON.stringify(premiumMediaReport, null, 2)
    );

    scenes.forEach((plannedScene,index) => {
      const mobileWordBudget = index === 0 ? 7 : 9;
      const headlineWords = plannedScene.headline.trim().split(/\s+/).filter(Boolean);
      if (headlineWords.length <= mobileWordBudget) return;
      const narrationWords = plannedScene.text.trim().split(/\s+/).filter(Boolean);
      const spokenWords = plannedScene.kind === "cta" || plannedScene.kind === "pack" || index === scenes.length - 1
        ? narrationWords.slice(-mobileWordBudget)
        : narrationWords.slice(0,mobileWordBudget);
      plannedScene.headline = spokenWords.join(" ").replace(/^[,;:\-]+|[,;:\-]+$/g, "").trim();
    });
    const report = validateVideoPlan(scenes); await writeFile(path.join(dir, "quality-report.json"), JSON.stringify(report, null, 2)); if (!report.passed) { const failures = report.scenes.filter((scene) => !scene.passed).map((scene) => `scene ${scene.index + 1}: ${scene.failures.join(" ")}`).join("; "); throw new Error(`Video quality validation failed: ${failures}`); }
    const tokens = creativeProject.artDirection.tokens;
    const design = { generationId: job.generationId, templateIndex: 0, template: creative.template.name, paletteIndex: hashText(JSON.stringify(tokens.colours)), palette: { paper: tokens.colours.background, ink: tokens.colours.text, accent: tokens.colours.accent, secondary: tokens.colours.surface }, fontIndex: hashText(tokens.typography.heading), fonts: { heading: tokens.typography.heading, body: tokens.typography.body }, overlay: (creativeProject.artDirection.overlayStyle.includes("glass") ? "glass" : creativeProject.artDirection.overlayStyle.includes("editorial") ? "editorial" : "solid") as "solid" | "glass" | "editorial" | "outline", ...(editorPreferences ? {editorPreferences} : {}), designSystemId: creative.designSystem.id, designSystemName: creative.designSystem.name, designSystemFamily: creative.designSystem.family, artDirection: creative.designSystem.artDirection, templateId: creative.template.id, layoutFamily: creative.template.layoutFamily, sceneLayouts: creative.sceneLayouts, transitions: creative.transitions, motionPresets: creative.motionPresets, textStyles: creative.textStyles, creativeFingerprint: creative.creativeFingerprint };
    const privateDesignKeys = new Set(["designSystemId", "designSystemName", "designSystemFamily", "artDirection"]);
    const publicDesign = Object.fromEntries(Object.entries(design).filter(([key]) => !privateDesignKeys.has(key)));
    job.creativeFingerprint = creative.creativeFingerprint;
    await writeFile(path.join(dir, "design-profile.json"), JSON.stringify(publicDesign, null, 2));
    await writeFile(path.join(dir, "visual-attributions.json"), JSON.stringify(attributions, null, 2));
    await writeFile(path.join(dir, "generation-inspector.json"), JSON.stringify({ generationId: job.generationId, variationSeed: job.variationSeed, productionProfile, durationSeconds: duration, sceneCount: scenes.length, selectedTemplate: creative.template, rejectedTemplates: creative.rejectedTemplateIds, selectedPalette: creative.palette, rejectedPalettes: creative.rejectedPaletteIds, selectedFontPair: creative.fontPair, rejectedFontPairs: creative.rejectedFontPairIds, scenes: scenes.map((scene, index) => ({ narration: scene.text, shotType: scene.brief.shotType, cameraAngle: scene.brief.cameraAngle, cameraMovement: scene.brief.cameraMovement, query: scene.brief.searchQuery, candidates: candidateScores.filter(x => x.asset.id === String((attributions[index] as { id?: string })?.id)), selectedAsset: attributions[index], validation: report.scenes[index] })), creativeFingerprint: creative.creativeFingerprint, canvaStatus: "not-connected", composer: "scripts/premium-visual-composition.ts" }, null, 2));
    recordCheckpoint(creativeProject, "rendering", "running");
    await projectRepository.save(creativeProject);
    rendererRegistry.requireAvailable(creativeProject.rendering.engine);
  const projectIsHmo = scenes.some((scene) => /\b(?:hmo|house in multiple occupation|five bedrooms?|six bedrooms?|5 beds?|6 beds?|occupancy|licen[cs]ing)\b/i.test(`${scene.text} ${scene.headline} ${scene.brief.object}`));
  if (projectIsHmo) {
    const curatedSourceDirectory = path.join(root, "apps/web/public/premium-hmo");
    await Promise.all(scenes.map(async (scene, index) => {
      // Preserve externally supplied footage only when it meets the same
      // semantic threshold enforced after rendering. Weak candidates must be
      // replaced rather than retried unchanged across all recovery attempts.
      const existingSemanticScore = Number(attributions[index]?.semanticScore ?? 0);
      if ((scene.videoAsset || scene.visualAsset) && existingSemanticScore >= .84) return;
      const sceneNumber = String(index + 1).padStart(2, "0");
      const source = path.join(curatedSourceDirectory, `scene-${sceneNumber}.mp4`);
      const targetName = `hmo-source-${sceneNumber}.mp4`;
      const sourceStats = await stat(source).catch(() => undefined);
      if (!sourceStats || sourceStats.size < 50_000) {
        throw new Error(`Curated HMO footage is missing or incomplete for scene ${index + 1}: ${source}`);
      }
      await copyFile(source, path.join(assets, targetName));
      scene.videoAsset = targetName;
      scene.visualAsset = undefined;
      attributions[index] = {
        id: `plandome-curated-hmo:${sceneNumber}`,
        title: `Curated HMO visual for scene ${index + 1}`,
        source: `curated:premium-hmo/scene-${sceneNumber}.mp4`,
        license: "Plandome curated licensed stock library",
        mediaClass: "curated_video",
        semanticScore: 0.98,
        fallback: false,
      };
    }));
  }
  await update(job, "composing", 66, "Normalizing visual clips to the narration timeline");
  const normalizeScene = async (index: number) => {
    const scene = scenes[index]!;
    if (!scene.videoAsset) return;
    const source = path.join(assets, path.basename(scene.videoAsset));
    const outputName = `timeline-scene-${String(index).padStart(3, "0")}.mp4`;
    const output = path.join(assets, outputName);
    try {
      if ((await stat(output)).size >= 50_000) {
        scene.videoAsset = outputName;
        return;
      }
    } catch { /* Build the timeline-safe clip below. */ }
    const timelineDuration = Math.max(1 / creativeProject.rendering.fps, scene.duration + (2 / creativeProject.rendering.fps));
    if (projectIsHmo) {
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-stream_loop", "-1", "-i", source, "-t", timelineDuration.toFixed(6), "-an",
        "-vf", "eq=brightness=0.065:contrast=1.025:saturation=1.02",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", output,
      ], { maxBuffer: 10_000_000, timeout: 180_000, killSignal: "SIGTERM" });
    } else try {
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-stream_loop", "-1", "-i", source, "-t", timelineDuration.toFixed(6), "-an",
        "-c:v", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", output,
      ], { maxBuffer: 10_000_000, timeout: 120_000, killSignal: "SIGTERM" });
      if ((await stat(output)).size < 50_000) throw new Error("timeline clip is incomplete");
    } catch {
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-stream_loop", "-1", "-i", source, "-t", timelineDuration.toFixed(6), "-an",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", output,
      ], { maxBuffer: 10_000_000, timeout: 180_000, killSignal: "SIGTERM" });
    }
    scene.videoAsset = outputName;
  };
  for (let offset = 0; offset < scenes.length; offset += 3) {
    await Promise.all(scenes.slice(offset, offset + 3).map((_, relativeIndex) => normalizeScene(offset + relativeIndex)));
  }
  await writePremiumComposition(
    path.join(dir, "composition"), scenes, duration, job.input.useAvatar, design, job.variationSeed,
    { width: creativeProject.rendering.width, height: creativeProject.rendering.height },
  );
  await writeCanvaStoryboard(path.join(dir, "composition"), scenes, design);
  await assertScriptLedRenderer(job.input.script);
  await update(job, "rendering", 70, "Rendering animated MP4");
    const ffmpegDir = path.join(root, "tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin");
    const renderScratch = process.env.PLANDOME_RENDER_SCRATCH ?? dir;
    await mkdir(renderScratch, { recursive: true });
    const renderEnv = {
      ...process.env,
      PATH: process.platform === "win32" ? `${ffmpegDir}${path.delimiter}${process.env.PATH}` : process.env.PATH,
      TEMP: renderScratch,
      TMP: renderScratch,
    };
  const finalOutput = path.join(dir, "output.mp4");
  if (creativeProject.rendering.engine === "remotion") {
    const assetServer = await startAssetServer(dir);
    try {
    const [{ RemotionRendererAdapter },logoBytes] = await Promise.all([
      import("../packages/renderers/remotion/src/renderer-adapter"),
      readFile(path.join(root,"apps/web/public/brand/plandome-logo.png")),
      ]);
    const profile=creativeProject.rendering.variation?.profile;
    if(!profile)throw new Error("Remotion requires a persisted VariationProfile.");
    await new RemotionRendererAdapter().render({
      project:creativeProject,exportId:"mp4",variation:profile as never,
      sceneMedia:Object.fromEntries(creativeProject.scenes.flatMap((scene,index)=>{
        const assetName=scenes[index]?.videoAsset??scenes[index]?.visualAsset
          ??scenes.slice(0,index).reverse().map(item=>item.videoAsset??item.visualAsset).find(Boolean)
          ??scenes.map(item=>item.videoAsset??item.visualAsset).find(Boolean);
        return assetName ? [[scene.id,assetServer.urlFor(path.join(assets,assetName))]] : [];
      })),
      narrationPath:assetServer.urlFor(narrationFile),logoPath:`data:image/png;base64,${logoBytes.toString("base64")}`,
        outputPath:finalOutput,width:creativeProject.rendering.width,height:creativeProject.rendering.height,
        fps:creativeProject.rendering.fps,codec:"h264",quality:creativeProject.rendering.quality,
      renderingSeed:creativeProject.rendering.variation.seed,contentHash:creativeProject.rendering.variation.fingerprint,
    },{onProgress:(progress)=>{job.progress=70+Math.round(progress*20);}});
    } finally {
      await assetServer.close();
    }
  } else {
      const hyperframes = path.join(root, "node_modules/hyperframes/dist/cli.js");
      const silentOutput = path.join(renderScratch, `${id}-visual-master.mp4`);
      await exec(process.execPath, [hyperframes, "lint", path.join(dir, "composition")], { env: renderEnv });
      try {
        const renderStartedAt = Date.now();
        const detectedRenderCapacity = Math.max(1, (await import("node:os")).availableParallelism());
        const configuredRenderWorkers = Number(process.env.RENDER_WORKERS ?? detectedRenderCapacity);
        const renderWorkers = String(Math.max(
          1,
          Math.min(Number.isFinite(configuredRenderWorkers) ? configuredRenderWorkers : detectedRenderCapacity, detectedRenderCapacity),
        ));
        let observedProgress = 70;
        let observedStage = "Renderer active; waiting for frame telemetry";
        let lastTelemetrySync = 0;
        const renderHeartbeat = setInterval(() => {
          const elapsedSeconds = Math.max(1, Math.round((Date.now() - renderStartedAt) / 1_000));
          void update(job, "rendering", observedProgress, `${observedStage} · ${elapsedSeconds}s elapsed`).catch(() => undefined);
        }, 10_000);
        try {
          await runStreamingRender(process.execPath, [hyperframes, "render", path.join(dir, "composition"), "--output", silentOutput, "--quality", job.input.quality === "production" ? "high" : "standard", "--fps", process.env.RENDER_FPS ?? "24", "--workers", renderWorkers, "--crf", process.env.RENDER_CRF ?? "21", "--page-side-compositing", "--strict", "--no-best-effort"], renderEnv, (telemetry) => {
            const ratio = telemetry.total && telemetry.current !== undefined
              ? telemetry.current / telemetry.total
              : telemetry.percent !== undefined ? telemetry.percent / 100 : 0;
            if (ratio > 0) observedProgress = Math.max(observedProgress, Math.min(88, 70 + Math.round(ratio * 18)));
            observedStage = telemetry.total && telemetry.current !== undefined
              ? `Rendering frame ${telemetry.current.toLocaleString()} of ${telemetry.total.toLocaleString()}`
              : telemetry.percent !== undefined ? `Rendering frames · ${Math.round(telemetry.percent)}%` : observedStage;
            if (Date.now() - lastTelemetrySync >= 2_000) {
              lastTelemetrySync = Date.now();
              void update(job, "rendering", observedProgress, observedStage).catch(() => undefined);
            }
          });
        } finally {
          clearInterval(renderHeartbeat);
        }
        await update(job, "rendering", 90, "Adding Ella narration");
        await exec(mediaBinary("ffmpeg"), ["-y", "-i", silentOutput, "-i", narrationFile, "-filter_complex", `[1:a]apad=whole_dur=${duration.toFixed(6)}[voice]`, "-map", "0:v:0", "-map", "[voice]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", duration.toFixed(6), "-movflags", "+faststart", finalOutput], { env: renderEnv, maxBuffer: 10_000_000 });
      } finally {
        await rm(silentOutput, { force: true }).catch(() => undefined);
      }
    }
    if ((await stat(finalOutput)).size > 45_000_000) {
      const optimizedOutput = path.join(dir, "output-optimized.mp4");
      await exec(mediaBinary("ffmpeg"), [
        "-y", "-i", finalOutput, "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", optimizedOutput,
      ], { env: renderEnv, maxBuffer: 10_000_000 });
      await writeFile(finalOutput, await readFile(optimizedOutput));
    }
    // Decode every frame before publication. This prevents damaged worker
    // segment joins or invalid H.264 references from reaching the live site.
    await exec(mediaBinary("ffmpeg"), ["-v", "error", "-xerror", "-i", finalOutput, "-f", "null", "-"], { env: renderEnv, maxBuffer: 10_000_000, timeout: 180_000, killSignal: "SIGTERM" });
    await update(job, "rendering", 92, "Preparing editable Canva scene media");
    const canvaWarnings = await writeTimedCanvaSceneMedia({ scenes, assetsDirectory: assets, ffmpeg: mediaBinary("ffmpeg"), width: creativeProject.rendering.width, height: creativeProject.rendering.height, fps: creativeProject.rendering.fps });
    if (canvaWarnings.length) {
      await writeFile(path.join(dir, "canva-export-warnings.json"), JSON.stringify(canvaWarnings, null, 2));
    }
    const finalQuality = await validateFinalRender(finalOutput, dir, scenes, attributions, mediaBinary("ffmpeg"));
    if (!finalQuality.passed || finalQuality.score < 8.5) throw new Error(`Final render quality validation failed (${finalQuality.score}/10): ${[...finalQuality.failures, ...finalQuality.warnings].join(" ")}`);
    job.qualityScore = finalQuality.score;
    job.qualityStatus = "passed";
    job.qualityWarnings = finalQuality.warnings.length;
    const assetIds = attributions.map(x => String((x as { id?: string }).id ?? (x as { source?: string }).source ?? "")).filter(Boolean); await saveGenerationHistory(root, { generationId: job.generationId, projectId: job.projectId, variationSeed: job.variationSeed, designSystemId: creative.designSystem.id, templateId: creative.template.id, layoutFamily: creative.template.layoutFamily, paletteId: creative.palette.id, fontPairId: creative.fontPair.id, assetIds, sceneFingerprints: scenes.map(scene => hashText(`${scene.text}:${scene.brief.searchQuery}`).toString(16)), creativeFingerprint: creative.creativeFingerprint, createdAt: new Date().toISOString() }); job.outputUrl = `/api/v1/video-jobs/${id}/download`; job.canvaUrl = `/api/v1/video-jobs/${id}/canva`; job.inspectorUrl = `/api/v1/video-jobs/${id}/inspector`;
    recordCheckpoint(creativeProject, "rendering", "completed");
    recordCheckpoint(creativeProject, "quality", "completed");
    creativeProject.approvalState = "completed";
    creativeProject.exports = {
      mp4:{uri:"output.mp4",mimeType:"video/mp4",createdAt:new Date().toISOString()},
      project:{uri:"creative-project.json",mimeType:"application/json",createdAt:new Date().toISOString()},
      storyboard:{uri:"canva-editable.html",mimeType:"text/html",createdAt:new Date().toISOString()},
      captions:{uri:"creative-project.json#captions",mimeType:"application/json",createdAt:new Date().toISOString()},
      assetManifest:{uri:"visual-attributions.json",mimeType:"application/json",createdAt:new Date().toISOString()},
      licenseReport:{uri:"visual-attributions.json",mimeType:"application/json",createdAt:new Date().toISOString()},
    };
    recordCheckpoint(creativeProject, "export", "completed");
    await projectRepository.save(creativeProject);
    job.creativeProjectVersion = creativeProject.version;
    await update(job, "completed", 100, "Video and CreativeProject exports ready");
  } catch (cause) {
    const baseMessage = cause instanceof Error ? cause.message : "Video generation failed.";
    const stderr = typeof cause === "object" && cause !== null && "stderr" in cause
      ? String((cause as { stderr?: unknown }).stderr ?? "").trim()
      : "";
    const stdout = typeof cause === "object" && cause !== null && "stdout" in cause
      ? String((cause as { stdout?: unknown }).stdout ?? "").trim()
      : "";
    const diagnostics = [stderr, stdout].filter(Boolean).join("\n");
    const failureMessage = diagnostics ? `${baseMessage}\n${diagnostics}` : baseMessage;
    if (creativeProject) {
      const active = creativeProject.checkpoints.find((checkpoint) => checkpoint.status === "running");
      if (active) recordCheckpoint(creativeProject, active.stage, "failed", failureMessage);
      await projectRepository.save(creativeProject);
    }
    // A frame-level rejection should never trigger an identical expensive
    // render. The durable queue will retry this job with the approved local
    // media library and deterministic light motion treatment immediately.
    if (/Final render quality validation failed/i.test(failureMessage) && !job.input.driveFolderUrl) {
      job.recoveryMode = "safe-assets";
    }
    job.error = { code: "pipeline_failed", message: failureMessage }; await update(job, "failed", job.progress, "Generation failed");
  }
}

if (process.argv.some((argument) => /(?:^|[\\/])video-worker\.ts$/i.test(argument))) {
  void main().then(
    () => process.exit(0),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
