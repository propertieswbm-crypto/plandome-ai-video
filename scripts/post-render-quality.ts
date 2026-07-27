import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { PlannedScene } from "./video-composition";

const exec = promisify(execFile);

export type FinalRenderQualityReport = {
  passed: boolean;
  score: number;
  sampledFrames: Array<{ scene: number; file: string; mean: number; deviation: number }>;
  failures: string[];
  warnings: string[];
  fallbackScenes: number[];
};

function distance(a: Buffer, b: Buffer) {
  let changed = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) changed += Math.abs(a[i]! - b[i]!);
  return changed / Math.max(1, Math.min(a.length, b.length));
}

export async function validateFinalRender(
  video: string,
  outputDirectory: string,
  scenes: PlannedScene[],
  attributions: Array<Record<string, unknown>>,
  ffmpeg: string,
): Promise<FinalRenderQualityReport> {
  const framesDirectory = path.join(outputDirectory, "quality-frames");
  await mkdir(framesDirectory, { recursive: true });
  const failures: string[] = [];
  const warnings: string[] = [];
  const sampledFrames: FinalRenderQualityReport["sampledFrames"] = [];
  const fingerprints: Buffer[] = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index]!;
    const timestamp = scene.start + Math.min(Math.max(0.35, scene.duration * 0.55), Math.max(0.35, scene.duration - 0.2));
    const file = path.join(framesDirectory, `scene-${index + 1}.png`);
    await exec(ffmpeg, ["-y", "-loglevel", "error", "-ss", timestamp.toFixed(3), "-i", video, "-frames:v", "1", file]);
    const image = sharp(file).greyscale();
    const stats = await image.stats();
    const fingerprint = await image.resize(32, 32, { fit: "fill" }).raw().toBuffer();
    fingerprints.push(fingerprint);
    const mean = stats.channels[0]?.mean ?? 0;
    const deviation = stats.channels[0]?.stdev ?? 0;
    sampledFrames.push({ scene: index + 1, file: path.relative(outputDirectory, file), mean, deviation });
    if (deviation < 3 || mean < 2 || mean > 253) failures.push(`Scene ${index + 1} sampled as a blank or near-blank frame.`);
    if (scene.headline.length > 100) failures.push(`Scene ${index + 1} headline is likely to overflow (${scene.headline.length} characters).`);
    if (scene.text.length > 190) warnings.push(`Scene ${index + 1} caption is unusually long (${scene.text.length} characters).`);
    if (/Ã|Â|â€|�/.test(`${scene.headline} ${scene.text}`)) failures.push(`Scene ${index + 1} contains broken text encoding.`);
  }

  for (let i = 0; i < fingerprints.length; i += 1) {
    for (let j = i + 1; j < fingerprints.length; j += 1) {
      if (distance(fingerprints[i]!, fingerprints[j]!) < 0.8) warnings.push(`Scenes ${i + 1} and ${j + 1} have near-duplicate sampled frames.`);
    }
  }

  const fallbackScenes = attributions
    .map((attribution, index) => attribution.fallback === true || attribution.mediaClass === "procedural_fallback" ? index + 1 : 0)
    .filter(Boolean);
  if (fallbackScenes.length) warnings.push(`Procedural fallback visuals used in scenes ${fallbackScenes.join(", ")}.`);
  const normalCount = scenes.filter((scene) => !["avatar", "cta", "pack"].includes(scene.kind)).length;
  if (fallbackScenes.length > Math.max(1, normalCount / 2)) failures.push("More than half of normal scenes use procedural fallback visuals.");
  const ctaIndex = scenes.findIndex((scene) => scene.kind === "cta" || scene.kind === "pack");
  if (ctaIndex >= 0 && (sampledFrames[ctaIndex]?.deviation ?? 0) < 18) warnings.push("CTA frame may have weak visual contrast.");

  const duplicateFrameWarnings = warnings.filter((warning) => /near-duplicate sampled frames/i.test(warning)).length;
  const duplicateLimit = Math.max(1, Math.floor(scenes.length * 0.15));
  if (duplicateFrameWarnings > duplicateLimit) {
    failures.push(`Excessive duplicate sampled frames (${duplicateFrameWarnings}); maximum allowed is ${duplicateLimit}.`);
  }
  const score = Math.max(0, Math.min(10, 10 - failures.length * 1.5 - warnings.length * 0.35 - fallbackScenes.length * 0.45));
  const report = { passed: failures.length === 0, score: Number(score.toFixed(1)), sampledFrames, failures, warnings, fallbackScenes };
  await writeFile(path.join(outputDirectory, "final-render-quality.json"), JSON.stringify(report, null, 2));
  return report;
}
