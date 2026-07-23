import fs from "node:fs/promises";
import path from "node:path";
import {
  inspectPremiumAdMedia
} from "./premium-ad-quality-gate";
import { createVisualBrief } from "./video-quality";

async function run(): Promise<void> {
  const root = path.resolve(
    ".data",
    "premium-ad-quality-test"
  );

  await fs.rm(root, {
    recursive: true,
    force: true
  });

  await fs.mkdir(root, {
    recursive: true
  });

  await fs.writeFile(
    path.join(root, "scene-a.mp4"),
    Buffer.alloc(200_000, 1)
  );

  await fs.writeFile(
    path.join(root, "scene-b.mp4"),
    Buffer.alloc(200_000, 2)
  );

  const makeScene = (
    text: string,
    index: number,
    videoAsset: string
  ) =>
    ({
      text,
      headline: text,
      start: index * 5,
      duration: 5,
      kind: "property",
      brief: createVisualBrief(text, index),
      videoAsset
    }) as any;

  const unique = await inspectPremiumAdMedia(
    [
      makeScene("Scene one", 0, "scene-a.mp4"),
      makeScene("Scene two", 1, "scene-b.mp4")
    ],
    root
  );

  if (!unique.passed) {
    throw new Error(
      `Unique media incorrectly failed: ${unique.failures.join(
        " "
      )}`
    );
  }

  await fs.writeFile(
    path.join(root, "scene-c.mp4"),
    Buffer.alloc(200_000, 1)
  );

  const duplicate = await inspectPremiumAdMedia(
    [
      makeScene("Scene one", 0, "scene-a.mp4"),
      makeScene("Scene two", 1, "scene-c.mp4")
    ],
    root
  );

  if (duplicate.passed) {
    throw new Error("Duplicate media was not rejected.");
  }

  await fs.rm(root, {
    recursive: true,
    force: true
  });

  console.log("Premium advert quality-gate tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
