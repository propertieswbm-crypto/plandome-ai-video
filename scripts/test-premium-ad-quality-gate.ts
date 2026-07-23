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

  const duplicateSourceUrl = await inspectPremiumAdMedia(
    [
      makeScene("Scene with source A", 0, "scene-a.mp4"),
      makeScene("Scene with source A repeated", 1, "scene-b.mp4")
    ],
    root,
    [
      { sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg" },
      { sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg" }
    ]
  );

  if (duplicateSourceUrl.passed) {
    throw new Error("Duplicate source URL was not rejected.");
  }

  const imageOnlyPath = path.join(root, "scene-image.jpg");
  await fs.writeFile(imageOnlyPath, Buffer.alloc(120_000, 2));

  const imageOnly = await inspectPremiumAdMedia(
    [
      {
        text: "Scene image only",
        headline: "Scene image only",
        start: 0,
        duration: 5,
        kind: "property",
        brief: createVisualBrief("Scene image only", 0),
        visualAsset: "scene-image.jpg"
      } as any
    ],
    root
  );

  if (imageOnly.passed) {
    throw new Error("Image-only media was not rejected for a normal scene.");
  }

  const ctaReport = await inspectPremiumAdMedia(
    [
      {
        text: "Contact us for a decision pack",
        headline: "Contact us",
        start: 0,
        duration: 5,
        kind: "cta",
        brief: createVisualBrief("Contact us for a decision pack", 0)
      } as any
    ],
    root
  );

  if (!ctaReport.passed) {
    throw new Error("CTA scene incorrectly failed premium media validation.");
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
