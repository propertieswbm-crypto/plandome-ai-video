"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, FolderOpen, LoaderCircle, MonitorPlay, Play, Sparkles, UserRound, WandSparkles } from "lucide-react";
import type { VideoJob } from "@/lib/video/types";

const terminal = new Set(["completed", "failed"]);
const formatMetadata = {
  portrait: { label: "9:16", resolution: "1080 x 1920" },
  landscape: { label: "16:9", resolution: "1920 x 1080" },
  hz: { label: "16:9", resolution: "1920 x 1080" },
  sqr: { label: "1:1", resolution: "1080 x 1080" },
} as const;

function previewScenes(value: string) {
  const clean = value.trim().replace(/^[\"â€œâ€]+|[\"â€œâ€]+$/g, "").replace(/\s+/g, " ");
  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter((part) => /[a-z0-9]/i.test(part)) ?? [];
  const beats = sentences.flatMap((sentence) => {
    if (sentence.split(/\s+/).length <= 15) return [sentence];
    const clauses = sentence
      .split(/(?<=,|;)\s+|\s+(?=(?:but|while|because|particularly|as a result)\b)/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (clauses.length > 1) return clauses;
    const words = sentence.split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
  });
  return beats.reduce<string[]>((result, beat) => {
    if (beat.split(/\s+/).length < 3 && result.length) result[result.length - 1] = `${result[result.length - 1]} ${beat}`;
    else result.push(beat);
    return result;
  }, []);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`The server returned an empty response (${String(response.status)}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The server returned an invalid response (${String(response.status)}).`);
  }
}

export function NarrationStudio() {
  const [script, setScript] = useState("");
  const [quality, setQuality] = useState<"preview" | "production">("preview");
  const [useAvatar, setUseAvatar] = useState(true);
  const [sceneMediaUrls, setSceneMediaUrls] = useState<string[]>([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [format, setFormat] = useState<"portrait" | "landscape" | "hz" | "sqr">("portrait");
  const [generateAllFormats] = useState(true);
  const [job, setJob] = useState<VideoJob>();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [variantCount, setVariantCount] = useState<1 | 3 | 5>(1);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function poll(id: string, primary = false, attempt = 0) {
    try {
      const response = await fetch(`/api/v1/video-jobs/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read render progress.");
      const next = await readJson<VideoJob>(response);
      setError(undefined);
      setJobs((current) => current.map((item) => item.id === id ? next : item));
      if (primary) setJob(next);
      if (!terminal.has(next.status)) setTimeout(() => void poll(id, primary), 2_000);
    } catch (cause) {
      if (attempt < 3) {
        timer.current = setTimeout(() => void poll(id, primary, attempt + 1), 1_500);
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not read render progress.");
    }
  }

  async function generate() {
    if (script.trim().length < 20 || (job && !terminal.has(job.status))) return;
    setError(undefined);
    setJob(undefined);
    setJobs([]);
    const allFormats: Array<"portrait" | "hz" | "sqr"> = ["portrait", "hz", "sqr"];
    const campaignFamilies = ["authority", "risk", "aspiration", "proof", "urgency"];
    try {
      const campaignId = crypto.randomUUID();
      const formats = [format, ...allFormats.filter((targetFormat) => targetFormat !== format)];
      const created = await Promise.all(formats.map(async (targetFormat, index) => {
        const response = await fetch("/api/v1/video-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            script,
            format: targetFormat,
            quality,
            useAvatar,
            sceneMediaUrls,
            driveFolderUrl,
            renderer: "remotion",
            allowRendererFallback: false,
            campaignId,
            campaignFamily: generateAllFormats ? `${targetFormat}-${campaignFamilies[index % campaignFamilies.length]}` : campaignFamilies[index % campaignFamilies.length],
            variationSeed: crypto.randomUUID(),
            minimumVariationDistance: variantCount > 1 ? .55 : .35,
          }),
        });
        const body = await readJson<VideoJob & { detail?: string }>(response);
        if (!response.ok) throw new Error(body.detail ?? `Variant ${index + 1} could not be created.`);
        return body;
      }));
      setJobs(created);
      setJob(created[0]);
      created.forEach((createdJob, index) => void poll(createdJob.id, index === 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video job could not be created.");
    }
  }

  const busy = jobs.some((item) => !terminal.has(item.status)) || Boolean(job && !terminal.has(job.status));
  const scenes = previewScenes(script);

  return (
    <section className="studio-grid video-studio-grid studio-workspace">
      <div className="studio-panel">
        <div className="studio-panel-heading">
          <div>
            <p className="kicker">Script</p>
            <h2>Open Project</h2>
          </div>
          <span className="character-count">{script.length.toLocaleString()} / 3,000</span>
        </div>
        <div className="script-field">
          <textarea
            className="script-input video-script-input"
            value={script}
            onChange={(event) => setScript(event.target.value)}
            maxLength={3000}
            placeholder="Describe your video in one scene at a time..."
            aria-label="Video script"
          />
          <div className="script-hint">
            <WandSparkles size={14} />
            <span>Sentences are split into visual scenes.</span>
          </div>
        </div>
        <div className="pipeline-summary">
          {useAvatar && <span><Check size={12} /> Ella</span>}
          <span><Check size={12} /> ElevenLabs</span>
          <span><Check size={12} /> AI Director</span>
          <span><Check size={12} /> Scene QA</span>
          <span><Check size={12} /> Captions</span>
        </div>
        <label className={`avatar-toggle ${useAvatar ? "avatar-toggle-active" : ""}`}>
          <input type="checkbox" checked={useAvatar} onChange={(event) => setUseAvatar(event.target.checked)} disabled={busy} />
          <span className="option-icon"><UserRound size={18} /></span>
          <span><strong>Use Ella</strong><small>{useAvatar ? "Presenter scene on opening" : "No presenter"}</small></span>
          <span className="toggle-switch" aria-hidden="true" />
        </label>
        <div className="scene-media-panel">
          <div className="scene-media-heading">
            <span className="option-icon"><FolderOpen size={16} /></span>
            <span><strong>Google Drive</strong><small>AI selects the best visuals.</small></span>
          </div>
          <input
            type="url"
            value={driveFolderUrl}
            onChange={(event) => setDriveFolderUrl(event.target.value)}
            placeholder="Paste shared folder link"
            disabled={busy}
            aria-label="Google Drive folder link"
          />
        </div>
        {scenes.length > 0 && <div className="scene-media-panel">
          <div className="scene-media-heading">
            <span className="option-icon"><Play size={16} /></span>
            <span><strong>Replace media</strong><small>Drop media here or paste scene links.</small></span>
          </div>
          <div className="scene-media-list">
            {scenes.map((scene, index) => {
              const presenterScene = index === 0 && useAvatar;
              return <label key={`${index}-${scene.slice(0, 24)}`}>
                <span>Scene {index + 1}<small>{presenterScene ? "Ella presenter" : scene}</small></span>
                <input
                  type="url"
                  value={sceneMediaUrls[index] ?? ""}
                  onChange={(event) => setSceneMediaUrls((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })}
                  placeholder={presenterScene ? "Presenter generated" : "Paste scene media link"}
                  disabled={busy || presenterScene}
                  aria-label={`Scene ${index + 1} video URL`}
                />
              </label>;
            })}
          </div>
        </div>}
        <div className="studio-controls studio-controls-variants">
          <label>Format<select value={format} onChange={(event) => setFormat(event.target.value as "portrait" | "landscape" | "hz" | "sqr")} disabled={busy}>
            <option value="portrait">9:16</option>
            <option value="hz">16:9 (hz)</option>
            <option value="sqr">1:1 (sqr)</option>
          </select></label>
          <label><input type="checkbox" checked disabled /> One video per format</label>
          <label>Quality<select value={quality} onChange={(event) => setQuality(event.target.value as "preview" | "production")} disabled={busy}><option value="preview">Fast</option><option value="production">Premium</option></select></label>
          <label>Variants<select value={variantCount} onChange={(event) => setVariantCount(Number(event.target.value) as 1 | 3 | 5)} disabled={busy || generateAllFormats}><option value="1">1 ad</option><option value="3">3 ads</option><option value="5">5 ads</option></select></label>
        </div>
        {error && <div className="form-message form-error" role="alert">{error}</div>}
        {job?.error && <div className="form-message form-error" role="alert">{job.error.message}</div>}
        <button className="button button-primary button-full button-large" type="button" onClick={generate} disabled={busy || script.trim().length < 20}>
          {busy ? <><LoaderCircle className="spin" size={18} /> {job?.stage || "Generating"}</> : <><Sparkles size={18} /> Generate</>}
        </button>
        {job && <div className="job-progress" aria-live="polite"><div><span>{job.stage}</span><strong>{job.progress}%</strong></div><progress max="100" value={job.progress} /></div>}
      </div>
      <aside className="studio-panel preview-panel video-preview-panel">
        <div className="preview-heading">
          <div>
            <p className="kicker">Preview</p>
            <h2>Output</h2>
          </div>
          <span className="format-pill">{job ? formatMetadata[job.input.format].label : formatMetadata[format].label}</span>
        </div>
        {job?.status === "completed" && <div className="editor-optional-notice"><strong>Ready</strong><span>Open the editor for scene-level controls.</span></div>}
        {job?.status === "completed" && job.outputUrl ? <div className="video-result">
          <video controls playsInline src={job.outputUrl} />
          <Link className="button button-primary button-full" href={`/video-editor?job=${job.id}`}><Play size={17} /> Edit</Link>
          <a className="button button-secondary button-full" href={job.outputUrl} download><Download size={17} /> Export</a>
          {job.canvaUrl && <a className="button button-secondary button-full" href={job.canvaUrl} download><Download size={17} /> Download storyboard</a>}
        </div> : <div className="audio-empty video-empty">
          <div className="preview-device"><MonitorPlay size={30} /><span>{formatMetadata[format].resolution}</span></div>
          <h3>No projects</h3>
          <p>Create your first video</p>
          <div className="preview-steps"><span>01 · Script</span><span>02 · Generate</span><span>03 · Render</span></div>
        </div>}
        {jobs.length > 1 && <div className="variant-results">
          <div className="variant-results-head"><strong>Creative set</strong><span>{jobs.filter((item) => item.status === "completed").length}/{jobs.length} ready</span></div>
          {jobs.map((item, index) => <button key={item.id} className={item.id === job?.id ? "active" : ""} onClick={() => setJob(item)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{generateAllFormats ? item.input.format.toUpperCase() : ["Authority", "Risk", "Aspiration", "Proof", "Urgency"][index]}</strong><small>{item.status === "completed" ? "Ready to edit" : item.stage}</small></div>
            <i>{item.progress}%</i>
          </button>)}
        </div>}
      </aside>
    </section>
  );
}
