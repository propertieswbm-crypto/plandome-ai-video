import {
  buildReplicateImagePrompt,
  buildReplicateMotionPrompt,
  extractReplicateOutputUrl
} from "./replicate-visual-provider";

const baseRequest = {
  sceneId: "scene-01",
  sceneIndex: 0,
  totalScenes: 4,
  category: "property_exterior" as const,
  prompt:
    "Photorealistic cinematic UK Victorian terraced property exterior with a professional planning assessment.",
  negativePrompt:
    "cartoon, illustration, distorted architecture, generated text",
  fullScript:
    "Check the planning route before committing to construction.",
  seed: 12345,
  durationSeconds: 5
};

const first = buildReplicateImagePrompt(baseRequest);
const second = buildReplicateImagePrompt({
  ...baseRequest,
  sceneId: "scene-02",
  sceneIndex: 1
});

if (!first.includes("vertical 9:16")) {
  throw new Error("Image prompt is missing the portrait advert format.");
}

if (!first.includes("photorealistic")) {
  throw new Error("Image prompt is missing photorealistic direction.");
}

if (first === second) {
  throw new Error("Different scenes produced identical prompts.");
}

const motion = buildReplicateMotionPrompt(baseRequest);

if (!motion.includes("Preserve the exact building")) {
  throw new Error("Motion prompt is missing geometry preservation.");
}

const direct = extractReplicateOutputUrl(
  "https://replicate.delivery/test.mp4"
);

const nested = extractReplicateOutputUrl({
  output: ["https://replicate.delivery/test.jpg"]
});

if (
  !direct.endsWith("test.mp4") ||
  !nested.endsWith("test.jpg")
) {
  throw new Error("Replicate output URL extraction failed.");
}

console.log("Replicate premium visual provider tests passed.");
