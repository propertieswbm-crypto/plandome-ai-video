
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const source = await readFile(
    "scripts/premium-visual-orchestrator.ts",
    "utf8"
  );

  if (!source.includes('provider === "no_api"')) {
    throw new Error("The no-key visual provider is not routed.");
  }

  if (!source.includes('source: "no_api_commons"')) {
    throw new Error("The no-key provider source is not reported.");
  }

  if (
    !source.includes('scene.category !== "brand_cta"')
  ) {
    throw new Error(
      "Normal advert scenes are not routed through the media provider."
    );
  }

  console.log(
    "No-key cinematic provider routing tests passed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
