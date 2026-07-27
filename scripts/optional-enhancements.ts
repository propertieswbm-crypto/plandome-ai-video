import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const exec = promisify(execFile);

export type EnhancementResult = {
  outputPath: string;
  realEsrgan: "applied" | "not_needed" | "skipped_no_checkpoint" | "failed";
  rife: "applied" | "not_needed" | "skipped_no_checkpoint" | "failed";
};

async function hasModel(directory: string) {
  try {
    const entries = await readdir(directory, { recursive: true });
    return entries.some((entry) => /\.(pth|pkl|pt)$/i.test(String(entry)));
  } catch {
    return false;
  }
}

export async function enhanceVisualIfNeeded(
  input: string,
  outputDirectory: string,
  ffprobe: string,
): Promise<EnhancementResult> {
  const root = path.resolve(import.meta.dirname, "..");
  const extension = path.extname(input).toLowerCase();
  const image = [".jpg", ".jpeg", ".png", ".webp"].includes(extension);
  const video = [".mp4", ".mov", ".webm", ".m4v"].includes(extension);
  const result: EnhancementResult = { outputPath: input, realEsrgan: "not_needed", rife: "not_needed" };
  await mkdir(outputDirectory, { recursive: true });

  if (image) {
    const metadata = await sharp(input).metadata();
    const lowResolution = (metadata.width ?? 0) < 1080 || (metadata.height ?? 0) < 1280;
    if (lowResolution) {
      const repository = path.join(root, "vendor/ai-tools/Real-ESRGAN");
      if (!(await hasModel(path.join(repository, "weights")))) result.realEsrgan = "skipped_no_checkpoint";
      else {
        try {
          const before = new Set(await readdir(outputDirectory));
          await exec("python", [path.join(repository, "inference_realesrgan.py"), "-n", "RealESRGAN_x4plus", "-i", input, "-o", outputDirectory, "--outscale", "2"]);
          const generated = (await readdir(outputDirectory)).find((name) => !before.has(name) && /\.(png|jpg|jpeg|webp)$/i.test(name));
          if (generated) { result.outputPath = path.join(outputDirectory, generated); result.realEsrgan = "applied"; }
          else result.realEsrgan = "failed";
        } catch { result.realEsrgan = "failed"; }
      }
    }
  }

  if (video) {
    try {
      const probe = await exec(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "default=nw=1:nk=1", input]);
      const [numerator, denominator] = probe.stdout.trim().split("/").map(Number);
      const fps = denominator ? numerator! / denominator : numerator!;
      if (Number.isFinite(fps) && fps < 24) {
        const repository = path.join(root, "vendor/ai-tools/RIFE");
        if (!(await hasModel(path.join(repository, "train_log")))) result.rife = "skipped_no_checkpoint";
        else {
          const output = path.join(outputDirectory, `${path.parse(input).name}-rife.mp4`);
          try {
            await exec("python", [path.join(repository, "inference_video.py"), "--exp=1", `--video=${input}`, `--output=${output}`]);
            if ((await stat(output)).size > 150_000) { result.outputPath = output; result.rife = "applied"; }
            else result.rife = "failed";
          } catch { result.rife = "failed"; }
        }
      }
    } catch { result.rife = "failed"; }
  }

  return result;
}
