import fs from "node:fs/promises";
import path from "node:path";

export interface ComfyUIConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  imageWorkflowPath?: string;
  videoWorkflowPath?: string;
  outputDirectory: string;
}

export interface ComfyGenerationRequest {
  sceneId: string;
  prompt: string;
  negativePrompt: string;
  mode: "image" | "video";
  seed: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  inputImagePath?: string;
}

export interface ComfyGenerationResult {
  success: boolean;
  sceneId: string;
  outputPath?: string;
  promptId?: string;
  seed: number;
  attempts: number;
  error?: string;
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getComfyUIConfig(): ComfyUIConfig {
  const enabled =
    String(process.env.AI_VISUALS_ENABLED || "").toLowerCase() === "true";

  return {
    enabled,
    baseUrl: String(process.env.COMFYUI_BASE_URL || "")
      .trim()
      .replace(/\/+$/, ""),
    timeoutMs: numberFromEnv(process.env.COMFYUI_TIMEOUT_MS, 180000),
    maxRetries: Math.min(
      3,
      numberFromEnv(process.env.COMFYUI_MAX_RETRIES, 3)
    ),
    imageWorkflowPath: process.env.COMFYUI_WORKFLOW_IMAGE,
    videoWorkflowPath: process.env.COMFYUI_WORKFLOW_VIDEO,
    outputDirectory:
      process.env.COMFYUI_OUTPUT_DIR ||
      path.resolve("assets", "generated-visuals")
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function replaceWorkflowValues(
  value: unknown,
  replacements: Record<string, string | number>
): unknown {
  if (typeof value === "string") {
    let output = value;

    for (const [key, replacement] of Object.entries(replacements)) {
      output = output.replaceAll(`{{${key}}}`, String(replacement));
    }

    return output;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceWorkflowValues(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceWorkflowValues(child, replacements)
      ])
    );
  }

  return value;
}

async function loadWorkflow(
  workflowPath: string,
  request: ComfyGenerationRequest
): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(workflowPath, "utf8");
  const workflow = JSON.parse(raw) as Record<string, unknown>;

  return replaceWorkflowValues(workflow, {
    PROMPT: request.prompt,
    NEGATIVE_PROMPT: request.negativePrompt,
    SEED: request.seed,
    WIDTH: request.width || 1280,
    HEIGHT: request.height || 720,
    DURATION_SECONDS: request.durationSeconds || 4,
    INPUT_IMAGE: request.inputImagePath || "",
    SCENE_ID: request.sceneId
  }) as Record<string, unknown>;
}

export async function checkComfyUIHealth(
  config = getComfyUIConfig()
): Promise<boolean> {
  if (!config.enabled || !config.baseUrl) return false;

  try {
    const response = await fetchWithTimeout(
      `${config.baseUrl}/system_stats`,
      { method: "GET" },
      Math.min(config.timeoutMs, 10000)
    );

    return response.ok;
  } catch {
    return false;
  }
}

async function pollHistory(
  config: ComfyUIConfig,
  promptId: string
): Promise<Record<string, any>> {
  const started = Date.now();

  while (Date.now() - started < config.timeoutMs) {
    const response = await fetchWithTimeout(
      `${config.baseUrl}/history/${promptId}`,
      { method: "GET" },
      Math.min(config.timeoutMs, 15000)
    );

    if (response.ok) {
      const history = (await response.json()) as Record<string, any>;
      const result = history[promptId];

      if (result) return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("ComfyUI generation timed out.");
}

function extractOutputFilename(history: Record<string, any>): string | undefined {
  const outputs = history.outputs || {};

  for (const output of Object.values(outputs) as any[]) {
    const candidates = [
      ...(Array.isArray(output?.videos) ? output.videos : []),
      ...(Array.isArray(output?.gifs) ? output.gifs : []),
      ...(Array.isArray(output?.images) ? output.images : [])
    ];

    for (const candidate of candidates) {
      if (candidate?.filename) {
        return candidate.subfolder
          ? path.join(candidate.subfolder, candidate.filename)
          : candidate.filename;
      }
    }
  }

  return undefined;
}

export async function generateWithComfyUI(
  request: ComfyGenerationRequest,
  config = getComfyUIConfig()
): Promise<ComfyGenerationResult> {
  if (!config.enabled) {
    return {
      success: false,
      sceneId: request.sceneId,
      seed: request.seed,
      attempts: 0,
      error: "AI visuals are disabled."
    };
  }

  if (!config.baseUrl) {
    return {
      success: false,
      sceneId: request.sceneId,
      seed: request.seed,
      attempts: 0,
      error: "COMFYUI_BASE_URL is missing."
    };
  }

  const workflowPath =
    request.mode === "video"
      ? config.videoWorkflowPath
      : config.imageWorkflowPath;

  if (!workflowPath || !(await exists(workflowPath))) {
    return {
      success: false,
      sceneId: request.sceneId,
      seed: request.seed,
      attempts: 0,
      error: `ComfyUI ${request.mode} workflow is missing.`
    };
  }

  if (!(await checkComfyUIHealth(config))) {
    return {
      success: false,
      sceneId: request.sceneId,
      seed: request.seed,
      attempts: 0,
      error: "ComfyUI is unavailable."
    };
  }

  await fs.mkdir(config.outputDirectory, { recursive: true });

  let finalError = "Unknown ComfyUI failure.";

  for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
    try {
      const workflow = await loadWorkflow(workflowPath, {
        ...request,
        seed: request.seed + attempt - 1
      });

      const queueResponse = await fetchWithTimeout(
        `${config.baseUrl}/prompt`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: workflow })
        },
        config.timeoutMs
      );

      if (!queueResponse.ok) {
        throw new Error(
          `ComfyUI queue failed with HTTP ${queueResponse.status}.`
        );
      }

      const queueResult = (await queueResponse.json()) as {
        prompt_id?: string;
      };

      if (!queueResult.prompt_id) {
        throw new Error("ComfyUI did not return a prompt ID.");
      }

      const history = await pollHistory(config, queueResult.prompt_id);
      const relativeOutput = extractOutputFilename(history);

      if (!relativeOutput) {
        throw new Error("ComfyUI completed without a usable output file.");
      }

      const outputPath = path.resolve(
        config.outputDirectory,
        relativeOutput
      );

      if (!(await exists(outputPath))) {
        throw new Error(`Generated output does not exist: ${outputPath}`);
      }

      const stat = await fs.stat(outputPath);

      if (stat.size < 1024) {
        throw new Error("Generated output is empty or invalid.");
      }

      return {
        success: true,
        sceneId: request.sceneId,
        outputPath,
        promptId: queueResult.prompt_id,
        seed: request.seed + attempt - 1,
        attempts: attempt
      };
    } catch (error) {
      finalError =
        error instanceof Error ? error.message : "Unknown ComfyUI error.";

      if (attempt < config.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500 * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  return {
    success: false,
    sceneId: request.sceneId,
    seed: request.seed,
    attempts: config.maxRetries,
    error: finalError
  };
}
