import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PlannedScene } from "./video-composition";

export interface PremiumAdMediaReport {
  passed: boolean;
  mediaSceneCount: number;
  videoSceneCount: number;
  videoRatio: number;
  duplicateGroups: string[][];
  failures: string[];
}

function envBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value === undefined || value.trim() === "") return fallback;

  return value.trim().toLowerCase() === "true";
}

function minimumVideoRatio(): number {
  const parsed = Number(process.env.MIN_VIDEO_SCENE_RATIO ?? "1");

  if (!Number.isFinite(parsed)) return 1;

  return Math.max(0, Math.min(1, parsed));
}

async function mediaHash(filePath: string): Promise<string> {
  const data = await readFile(filePath);

  return createHash("sha256").update(data).digest("hex");
}

export async function inspectPremiumAdMedia(
  scenes: PlannedScene[],
  assetsDirectory: string
): Promise<PremiumAdMediaReport> {
  const failures: string[] = [];

  const mediaScenes = scenes
    .map((scene, index) => ({
      scene,
      index
    }))
    .filter(
      ({ scene }) =>
        !["avatar", "cta", "pack"].includes(scene.kind)
    );

  const hashes = new Map<
    string,
    Array<{
      index: number;
      file: string;
    }>
  >();

  let videoSceneCount = 0;

  for (const { scene, index } of mediaScenes) {
    const asset = scene.videoAsset || scene.visualAsset;

    if (!asset) {
      failures.push(
        `Scene ${index + 1} has no photographic or video media.`
      );

      continue;
    }

    if (scene.videoAsset) {
      videoSceneCount += 1;
    }

    const filePath = path.join(assetsDirectory, asset);

    try {
      const file = await stat(filePath);
      const minimumBytes = scene.videoAsset ? 150_000 : 50_000;

      if (file.size < minimumBytes) {
        failures.push(
          `Scene ${index + 1} media is too small: ${file.size} bytes.`
        );
        continue;
      }

      const hash = await mediaHash(filePath);
      const existing = hashes.get(hash) || [];

      existing.push({
        index,
        file: asset
      });

      hashes.set(hash, existing);
    } catch {
      failures.push(
        `Scene ${index + 1} media file is missing: ${asset}.`
      );
    }
  }

  const duplicateGroups = [...hashes.values()]
    .filter((group) => group.length > 1)
    .map((group) =>
      group.map(
        ({ index, file }) => `scene ${index + 1}: ${file}`
      )
    );

  for (const group of duplicateGroups) {
    failures.push(
      `Repeated media detected across ${group.join(", ")}.`
    );
  }

  const videoRatio =
    mediaScenes.length === 0
      ? 1
      : videoSceneCount / mediaScenes.length;

  const requiredRatio = minimumVideoRatio();

  if (videoRatio < requiredRatio) {
    failures.push(
      `Only ${(videoRatio * 100).toFixed(
        0
      )}% of normal scenes contain video. Required: ${(
        requiredRatio * 100
      ).toFixed(0)}%.`
    );
  }

  return {
    passed: failures.length === 0,
    mediaSceneCount: mediaScenes.length,
    videoSceneCount,
    videoRatio,
    duplicateGroups,
    failures
  };
}

export async function assertPremiumAdMedia(
  scenes: PlannedScene[],
  assetsDirectory: string
): Promise<PremiumAdMediaReport> {
  const report = await inspectPremiumAdMedia(
    scenes,
    assetsDirectory
  );

  if (
    envBoolean(process.env.STRICT_PREMIUM_ADS, true) &&
    !report.passed
  ) {
    throw new Error(
      `Premium advert media validation failed: ${report.failures.join(
        " "
      )}`
    );
  }

  return report;
}
