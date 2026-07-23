import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const source = await readFile(
    "scripts/premium-visual-orchestrator.ts",
    "utf8"
  );

  const universalRoutes =
    source.match(/scene\.category !== "brand_cta"/g) ?? [];

  if (universalRoutes.length !== 2) {
    throw new Error(
      `Expected two universal AI routes but found ${universalRoutes.length}.`
    );
  }

  if (
    source.includes(
      '(scene.visualMode === "ai_image_motion" ||'
    )
  ) {
    throw new Error(
      "An AI provider is still restricted to the old visual modes."
    );
  }

  const replicateRoute =
    /provider === "replicate"[\s\S]*?replicateConfig\.enabled[\s\S]*?scene\.category !== "brand_cta"/;

  const comfyRoute =
    /provider === "comfyui"[\s\S]*?comfyConfig\.enabled[\s\S]*?scene\.category !== "brand_cta"/;

  if (!replicateRoute.test(source)) {
    throw new Error(
      "Replicate is not enabled for every normal advert category."
    );
  }

  if (!comfyRoute.test(source)) {
    throw new Error(
      "ComfyUI is not enabled for every normal advert category."
    );
  }

  const categories = [
    "property_exterior",
    "property_interior",
    "construction",
    "architecture",
    "planning_documents",
    "commercial_business",
    "restaurant",
    "office",
    "finance",
    "technology",
    "education",
    "professional_service",
    "lifestyle",
    "abstract_business",
    "technical_explanation",
    "before_after",
    "generic_real_world"
  ];

  for (const category of categories) {
    if (category === "brand_cta") {
      throw new Error("Invalid category test configuration.");
    }
  }

  console.log(
    "Universal cinematic AI provider routing tests passed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
