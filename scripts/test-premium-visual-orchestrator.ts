import fs from "node:fs/promises";
import path from "node:path";
import { planVisualScenes } from "./universal-visual-planner";
import {
  findRealisticLocalFallback
} from "./premium-visual-orchestrator";

async function run(): Promise<void> {
  const testRoot = path.resolve("assets", "visual-library-test");
  const videoDirectory = path.join(
    testRoot,
    "videos",
    "property-exterior"
  );

  await fs.mkdir(videoDirectory, { recursive: true });

  const fallbackVideo = path.join(
    videoDirectory,
    "real-property-test.mp4"
  );

  await fs.writeFile(fallbackVideo, Buffer.alloc(4096));

  const propertyScene = planVisualScenes(
    "A real UK property should be checked before conversion work begins."
  )[0];

  const local = await findRealisticLocalFallback(
    propertyScene,
    testRoot
  );

  if (!local.video || !local.video.endsWith("real-property-test.mp4")) {
    throw new Error("Realistic local fallback lookup failed.");
  }

  await fs.rm(testRoot, { recursive: true, force: true });

  console.log("Premium visual orchestrator tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
