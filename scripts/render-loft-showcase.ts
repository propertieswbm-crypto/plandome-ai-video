import { execFile } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { createVideoJob, saveVideoJob } from "../apps/web/lib/video/job-store";
import { createVariationIdentity, selectCreative } from "../apps/web/lib/video/creative-system";
import { createVisualBrief, type DesignProfile } from "./video-quality";
import { writePremiumComposition, type PlannedScene } from "./premium-visual-composition";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const ffmpegDir = path.join(root, "tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin");
const ffmpeg = path.join(ffmpegDir, "ffmpeg.exe");
const ffprobe = path.join(ffmpegDir, "ffprobe.exe");
const sourceNarration = path.join(root, ".data/video-jobs/01a4cbb2-199c-4a3b-acdf-c9403e702fc2/composition/assets/narration.mp3");
const sourceVisuals = path.join(root, "assets/generated-loft-sample");

async function main() {
  const script = "Need more space without moving house? A loft conversion can transform your unused attic into a beautiful bedroom, home office, playroom, or guest suite. It's a smart way to increase your living space while adding value to your property. With thoughtful design and professional craftsmanship, your empty loft can become one of the most functional and stylish rooms in your home. Turn wasted space into your dream space with a loft conversion.";
  const id = randomUUID();
  const identity = createVariationIdentity("plandome-victorian-loft-showcase");
  const job = await createVideoJob(id, { script, format: "portrait", quality: "production", useAvatar: false, sceneMediaUrls: [] }, identity);
  const directory = path.join(root, ".data/video-jobs", id);
  const composition = path.join(directory, "composition");
  const assets = path.join(composition, "assets");
  await mkdir(assets, { recursive: true });

  const files = ["01-feasibility.png", "02-finished-room.png", "03-dormer.png", "04-plans.png", "05-staircase.png"];
  await Promise.all(files.map((file) => copyFile(path.join(sourceVisuals, file), path.join(assets, file))));
  await copyFile(sourceNarration, path.join(assets, "narration.mp3"));
  await copyFile(path.join(root, "apps/web/public/brand/plandome-logo.png"), path.join(assets, "logo.png"));

  const { stdout } = await exec(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", sourceNarration]);
  const duration = Number(stdout.trim());
  const lines = [
    "Need more space without moving house?",
    "Transform an unused Victorian attic into a beautiful new room.",
    "A well-designed rear dormer unlocks practical headroom and daylight.",
    "Planning and structural drawings create a buildable route.",
    "Turn wasted roof space into your dream space with Plandome.",
  ];
  const weights = [0.15, 0.27, 0.2, 0.22, 0.16];
  let start = 0;
  const scenes: PlannedScene[] = lines.map((text, index) => {
    const sceneDuration = index === lines.length - 1 ? duration - start : duration * weights[index]!;
    const scene: PlannedScene = {
      text,
      headline: ["SPACE WITHOUT MOVING", "A ROOM ABOVE", "VICTORIAN DORMER", "DESIGN BEFORE BUILD", "UNLOCK YOUR LOFT"][index]!,
      visualAsset: files[index],
      start,
      duration: sceneDuration,
      kind: index === lines.length - 1 ? "cta" : index === 3 ? "planning" : "property",
      brief: createVisualBrief(`${text} UK Victorian loft conversion`, index, lines.length, duration),
    };
    start += sceneDuration;
    return scene;
  });

  const creative = selectCreative(identity, [], scenes.length);
  const design: DesignProfile = {
    generationId: identity.generationId,
    templateIndex: 8,
    template: creative.template.name,
    paletteIndex: 0,
    palette: { paper: "#E8E0CF", ink: "#12263A", accent: "#C99748", secondary: "#FFFDF7" },
    fontIndex: 0,
    fonts: { heading: creative.fontPair.headingFont, body: creative.fontPair.bodyFont },
    overlay: "editorial",
    designSystemId: creative.designSystem.id,
    designSystemName: creative.designSystem.name,
    designSystemFamily: creative.designSystem.family,
    artDirection: creative.designSystem.artDirection,
    creativeFingerprint: creative.creativeFingerprint,
  };
  await writePremiumComposition(composition, scenes, duration, false, design, identity.variationSeed);

  const env = { ...process.env, PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH}` };
  const hyperframes = path.join(root, "node_modules/hyperframes/dist/cli.js");
  const silent = path.join(directory, "visual-master.mp4");
  const output = path.join(directory, "output.mp4");
  await exec(process.execPath, [hyperframes, "lint", composition], { env, maxBuffer: 10_000_000 });
  await exec(process.execPath, [hyperframes, "render", composition, "--output", silent, "--quality", "high", "--fps", "30", "--workers", "2", "--strict"], { env, maxBuffer: 10_000_000 });
  await exec(ffmpeg, ["-y", "-i", silent, "-i", sourceNarration, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", output], { env, maxBuffer: 10_000_000 });

  job.status = "completed";
  job.progress = 100;
  job.stage = "Victorian loft sample ready";
  job.outputUrl = `/api/v1/video-jobs/${id}/download`;
  job.creativeFingerprint = creative.creativeFingerprint;
  await saveVideoJob(job);
  process.stdout.write(id);
}

void main();
