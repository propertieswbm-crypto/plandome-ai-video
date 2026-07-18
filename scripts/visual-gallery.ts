import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type GalleryAsset = {
  id: string;
  file: string;
  kind: "image" | "video";
  tags: string[];
  description?: string;
  architecture?: string[];
  location?: string[];
  objects?: string[];
  actions?: string[];
  orientation?: "vertical" | "horizontal" | "square";
  width?: number;
  height?: number;
  qualityScore?: number;
  blurScore?: number;
};

export type ScoredGalleryAsset = { asset: GalleryAsset; semanticScore: number; scriptKeywordScore: number; architectureScore: number; locationScore: number; qualityScore: number; aspectRatioScore: number; freshnessScore: number; repetitionPenalty: number; forbiddenConceptPenalty: number; finalScore: number; rejectionReasons: string[] };

const aliases: Record<string, string[]> = {
  extension: ["rear", "house", "completed", "proposed", "modern"],
  planning: ["application", "permission", "council", "approval", "documents"],
  drawing: ["drawings", "plan", "plans", "blueprint", "floor"],
  property: ["house", "home", "residential", "building"],
  risk: ["assessment", "constraints", "rejected", "comparison", "survey"],
  victorian: ["heritage", "period", "traditional", "british"],
};

function tokens(value: string) {
  const found = new Set(value.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 2) ?? []);
  for (const [word, related] of Object.entries(aliases)) if (found.has(word) || related.some((item) => found.has(item))) {
    found.add(word); related.forEach((item) => found.add(item));
  }
  return found;
}

export async function loadGallery(root: string): Promise<GalleryAsset[]> {
  return JSON.parse(await readFile(path.join(root, "config/visual-gallery.json"), "utf8")) as GalleryAsset[];
}

async function ensureLocal(root: string, asset: GalleryAsset) {
  const target = path.join(root, ".data/asset-library/plandome-drive", asset.file);
  try { if ((await stat(target)).size > 50_000) return target; } catch { /* Download the public company asset below. */ }
  await mkdir(path.dirname(target), { recursive: true });
  const response = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(asset.id)}&export=download&confirm=t`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Company gallery download failed (${response.status}) for ${asset.file}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (asset.kind === "video" ? !contentType.startsWith("video/") : !contentType.startsWith("image/")) throw new Error(`Company gallery returned invalid media for ${asset.file}.`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 50_000) throw new Error(`Company gallery asset ${asset.file} is unexpectedly small.`);
  await writeFile(target, data); return target;
}

function seededUnit(seed: string, value: string) { let hash = 2166136261; for (const char of `${seed}:${value}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 4294967295; }

export async function resolveGalleryAsset(options: { root: string; sentence: string; briefText: string; sceneIndex: number; seed: string | number; usedIds: Set<string>; recentIds?: Set<string>; forbiddenTerms?: string[]; outputDirectory: string; scoringLog?: ScoredGalleryAsset[] }) {
  const query = tokens(`${options.sentence} ${options.briefText}`);
  const gallery = await loadGallery(options.root);
  const forbidden = new Set((options.forbiddenTerms ?? []).flatMap((term) => [...tokens(term)]));
  const ranked: ScoredGalleryAsset[] = gallery.filter((asset) => !options.usedIds.has(asset.id)).map((asset) => {
    const metadata = `${asset.tags.join(" ")} ${asset.description ?? ""} ${(asset.architecture ?? []).join(" ")} ${(asset.location ?? []).join(" ")} ${(asset.objects ?? []).join(" ")} ${(asset.actions ?? []).join(" ")}`;
    const assetTokens = tokens(metadata); const matches = [...query].filter((token) => assetTokens.has(token)).length; const denominator = Math.max(1, Math.min(query.size, 12));
    const semanticScore = Math.min(1, matches / denominator * 1.8); const scriptKeywordScore = Math.min(1, matches / Math.max(1, tokens(options.sentence).size));
    const architectureScore = assetTokens.has("victorian") || assetTokens.has("heritage") || assetTokens.has("british") ? 1 : assetTokens.has("modern") ? .25 : .65;
    const locationScore = assetTokens.has("uk") || assetTokens.has("british") || assetTokens.has("london") ? 1 : .45;
    const qualityScore = asset.qualityScore ?? ((Math.max(asset.width ?? 0, asset.height ?? 0) >= 1920 || (!asset.width && !asset.height)) ? .85 : .55);
    const aspectRatioScore = asset.orientation === "vertical" ? 1 : asset.orientation === "square" ? .75 : .65; const freshnessScore = options.recentIds?.has(asset.id) ? 0 : 1;
    const repetitionPenalty = options.recentIds?.has(asset.id) ? .42 : 0; const forbiddenMatches = [...forbidden].filter((token) => assetTokens.has(token)); const forbiddenConceptPenalty = forbiddenMatches.length ? .7 : 0;
    const finalScore = semanticScore*.35 + scriptKeywordScore*.20 + architectureScore*.15 + locationScore*.10 + qualityScore*.10 + aspectRatioScore*.05 + freshnessScore*.05 - repetitionPenalty - forbiddenConceptPenalty;
    const rejectionReasons = [...(locationScore < .8 ? ["UK location confidence below 0.80"] : []), ...(architectureScore < .8 ? ["Victorian architecture confidence below 0.80"] : []), ...(forbiddenMatches.length ? [`Forbidden concepts: ${forbiddenMatches.join(", ")}`] : []), ...(qualityScore < .8 ? ["Quality below 0.80"] : [])];
    return { asset, semanticScore, scriptKeywordScore, architectureScore, locationScore, qualityScore, aspectRatioScore, freshnessScore, repetitionPenalty, forbiddenConceptPenalty, finalScore, rejectionReasons };
  }).sort((a,b)=>b.finalScore-a.finalScore);
  options.scoringLog?.push(...ranked); const eligible = ranked.filter((item)=>item.finalScore>=.48 && item.architectureScore>=.8 && item.locationScore>=.8 && item.qualityScore>=.8).slice(0,8);
  const weightTotal=eligible.reduce((sum,item)=>sum+item.finalScore,0); let cursor=seededUnit(String(options.seed),`scene-${options.sceneIndex}`)*weightTotal; const selectedEntry=eligible.find((item)=>(cursor-=item.finalScore)<=0) ?? eligible.at(-1); const selected = selectedEntry?.asset;
  if (!selected) return undefined;
  const source = await ensureLocal(options.root, selected);
  const extension = path.extname(selected.file).toLowerCase();
  const outputFile = `gallery-${options.sceneIndex}${extension}`;
  await copyFile(source, path.join(options.outputDirectory, outputFile));
  options.usedIds.add(selected.id);
  return {
    file: outputFile,
    kind: selected.kind,
    assetId: selected.id,
    scores: selectedEntry,
    attribution: { id:selected.id, title: selected.tags[0], source: `https://drive.google.com/file/d/${selected.id}/view`, license: "User-provided company asset", provider: "Plandome Google Drive gallery" },
  };
}
