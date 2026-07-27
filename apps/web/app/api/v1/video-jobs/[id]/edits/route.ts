import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getVideoJob, jobDirectory } from "@/lib/video/job-store";
import { getRemoteObject, getRemoteVideoJob, putRemoteObject } from "@/lib/video/remote-store";
import { buildTimeline, type CreativeProject, type CameraMove, type ShotSize } from "@openvideo/creative-project";

export const runtime = "nodejs";

type EditProject = {
  jobId: string;
  scenes: Array<{
    id: string; text: string; duration: number; enabled: boolean;
    locked?: boolean; regenerationRequested?: boolean; templateId?: string;
    assetUri?: string; cameraMove?: CameraMove; shotSize?: ShotSize;
  }>;
  preferences: {
    captionScale: number;
    overlayOpacity: number;
    logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    logoScale: number;
    pacing: "measured" | "balanced" | "fast";
    notes: string;
  };
  revision: number;
  updatedAt: string;
};

function validProject(value: unknown, jobId: string): value is EditProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<EditProject>;
  return project.jobId === jobId
    && Array.isArray(project.scenes)
    && project.scenes.length <= 30
    && project.scenes.every((scene) => typeof scene?.id === "string" && typeof scene?.text === "string" && scene.text.length <= 500 && typeof scene?.duration === "number" && scene.duration >= 0.5 && scene.duration <= 30 && typeof scene?.enabled === "boolean"
      && (scene.assetUri === undefined || /^https?:\/\//.test(scene.assetUri))
      && (scene.templateId === undefined || scene.templateId.length <= 100))
    && Boolean(project.preferences)
    && typeof project.preferences?.captionScale === "number"
    && typeof project.preferences?.overlayOpacity === "number"
    && typeof project.preferences?.logoScale === "number"
    && typeof project.preferences?.notes === "string"
    && project.preferences.notes.length <= 2_000;
}

async function readEdits(id: string): Promise<EditProject | null> {
  if (process.env.VERCEL) {
    const response = await getRemoteObject(`edits/${id}.json`);
    return response ? await response.json() as EditProject : null;
  }
  try { return JSON.parse(await readFile(path.join(jobDirectory(id), "editor-edits.json"), "utf8")) as EditProject; }
  catch { return null; }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job) return NextResponse.json({ detail: "Video job not found." }, { status: 404 });
  return NextResponse.json({ job, edits: await readEdits(id) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job) return NextResponse.json({ detail: "Video job not found." }, { status: 404 });
  const value = await request.json().catch(() => null);
  if (!validProject(value, id)) return NextResponse.json({ detail: "The edit project is invalid." }, { status: 422 });
  const previous = await readEdits(id);
  const saved: EditProject = { ...value, revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
  const feedback = { projectId: job.projectId, sourceJobId: id, revision: saved.revision, preferences: saved.preferences, sceneCount: saved.scenes.filter((scene) => scene.enabled).length, sceneDurations: saved.scenes.filter((scene) => scene.enabled).map((scene) => scene.duration), updatedAt: saved.updatedAt };
  if (process.env.VERCEL) {
    await putRemoteObject(`edits/${id}.json`, JSON.stringify(saved), "application/json");
    await putRemoteObject(`feedback/${job.projectId}.json`, JSON.stringify(feedback), "application/json");
  } else {
    await mkdir(jobDirectory(id), { recursive: true });
    await writeFile(path.join(jobDirectory(id), "editor-edits.json"), JSON.stringify(saved, null, 2));
    const feedbackFile = path.resolve(".data", "editor-feedback.json");
    await mkdir(path.dirname(feedbackFile), { recursive: true });
    await writeFile(feedbackFile, JSON.stringify(feedback, null, 2));
    const projectFile = path.join(jobDirectory(id), "creative-project.json");
    try {
      const project = JSON.parse(await readFile(projectFile, "utf8")) as CreativeProject;
      let cursor = 0;
      for (const edit of saved.scenes) {
        const scene = project.scenes.find((item) => item.id === edit.id);
        if (!scene) continue;
        scene.narration = edit.text;
        scene.headline = edit.text.replace(/[?!.,]/g, "").split(/\s+/).slice(0,7).join(" ");
        scene.duration = edit.duration;
        scene.start = cursor;
        scene.enabled = edit.enabled;
        scene.locked = edit.locked ?? scene.locked;
        scene.regenerationRequested = edit.regenerationRequested ?? false;
        if (edit.templateId && project.templates.some((template) => template.id === edit.templateId)) scene.templateId = edit.templateId;
        if (edit.cameraMove) scene.camera.move = edit.cameraMove;
        if (edit.shotSize) scene.camera.shotSize = edit.shotSize;
        if (edit.assetUri) {
          const assetId = `editor-${scene.id}-${saved.revision}`;
          project.assets.push({ assetId,sceneId:scene.id,uri:edit.assetUri,provider:"user",mediaType:"video",semanticScore:1,qualityScore:1,reason:"User explicitly replaced this scene asset in the editor.",license:"User supplied",sourceUrl:edit.assetUri });
          scene.selectedAssetId = assetId;
        }
        if (scene.enabled) cursor += scene.duration;
      }
      project.version += 1;
      project.updatedAt = saved.updatedAt;
      project.brief.durationSeconds = cursor;
      project.artDirection.tokens.typography.scale = project.artDirection.tokens.typography.scale.map((size) => Math.round(size * saved.preferences.captionScale));
      project.timeline = buildTimeline(project.scenes, project.captions);
      project.history.push({ revision:project.version,timestamp:saved.updatedAt,actor:"user",action:"editor-save",changes:["scenes","timeline","artDirection","assets"] });
      await writeFile(projectFile, JSON.stringify(project,null,2));
    } catch { /* Legacy jobs remain editable through the compatibility edit file. */ }
  }
  return NextResponse.json(saved);
}
