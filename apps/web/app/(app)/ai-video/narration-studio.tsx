"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, LoaderCircle, Sparkles } from "lucide-react";
import type { VideoJob } from "@/lib/video/types";

const terminal = new Set(["completed", "failed"]);

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`The server returned an empty response (${response.status || "connection interrupted"}).`);
  try { return JSON.parse(text) as T; } catch { throw new Error(`The server returned an invalid response (${response.status}).`); }
}

export function NarrationStudio() {
  const [script, setScript] = useState("");
  const [quality, setQuality] = useState<"preview" | "production">("preview");
  const [useAvatar, setUseAvatar] = useState(true);
  const [job, setJob] = useState<VideoJob>();
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function poll(id: string, attempt = 0) {
    try {
      const response = await fetch(`/api/v1/video-jobs/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read render progress.");
      const next = await readJson<VideoJob>(response);
      setError(undefined); setJob(next);
      if (!terminal.has(next.status)) timer.current = setTimeout(() => void poll(id), 2_000);
    } catch (cause) {
      if (attempt < 3) { timer.current = setTimeout(() => void poll(id, attempt + 1), 1_500); return; }
      setError(cause instanceof Error ? cause.message : "Could not read render progress.");
    }
  }

  async function generate() {
    if (script.trim().length < 20 || (job && !terminal.has(job.status))) return;
    setError(undefined); setJob(undefined);
    try {
      const response = await fetch("/api/v1/video-jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ script, format: "portrait", quality, useAvatar }) });
      const body = await readJson<VideoJob & { detail?: string }>(response);
      if (!response.ok) throw new Error(body.detail ?? "Video job could not be created.");
      setJob(body); void poll(body.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Video job could not be created."); }
  }

  const busy = Boolean(job && !terminal.has(job.status));
  return (
    <section className="studio-grid video-studio-grid">
      <div className="studio-panel">
        <div className="studio-panel-heading"><div><p className="kicker">Full ad pipeline</p><h2>Paste one script. Generate the video.</h2></div><span className="character-count">{script.length}/3,000</span></div>
        <textarea className="script-input video-script-input" value={script} onChange={(event) => setScript(event.target.value)} maxLength={3000} placeholder="Paste your UK property or planning advert script here…" aria-label="Video script" />
        <div className="pipeline-summary">{useAvatar && <span>Standing Ella hook</span>}<span>ElevenLabs voice</span><span>Line-matched visuals</span><span>Animated captions</span></div>
        <label className="avatar-toggle"><input type="checkbox" checked={useAvatar} onChange={(event) => setUseAvatar(event.target.checked)} disabled={busy} /><span><strong>Use Ella presenter</strong><small>{useAvatar ? "HeyGen creates a standing presenter for the opening hook." : "Faster mode: skip HeyGen and create the full advert in HyperFrames."}</small></span></label>
        <div className="studio-controls">
          <label>Format<select value="portrait" disabled><option>9:16 portrait ad</option></select></label>
          <label>Render quality<select value={quality} onChange={(event) => setQuality(event.target.value as "preview" | "production")} disabled={busy}><option value="preview">Fast preview</option><option value="production">Production quality</option></select></label>
        </div>
        {error && <div className="form-message form-error" role="alert">{error}</div>}
        {job?.error && <div className="form-message form-error" role="alert">{job.error.message}</div>}
        <button className="button button-primary button-full button-large" type="button" onClick={generate} disabled={busy || script.trim().length < 20}>
          {busy ? <><LoaderCircle className="spin" size={18} /> {job?.stage}</> : <><Sparkles size={18} /> Generate complete AI video</>}
        </button>
        {job && <div className="job-progress" aria-live="polite"><div><span>{job.stage}</span><strong>{job.progress}%</strong></div><progress max="100" value={job.progress} /></div>}
      </div>
      <aside className="studio-panel preview-panel video-preview-panel">
        <p className="kicker">Rendered output</p><h2>Plandome vertical advert</h2>
        {job?.status === "completed" && job.outputUrl ? <div className="video-result"><video controls playsInline src={job.outputUrl} /><a className="button button-secondary button-full" href={job.outputUrl} download><Download size={17} /> Download MP4</a>{job.canvaUrl && <a className="button button-secondary button-full" href={job.canvaUrl} download><Download size={17} /> Download static Canva storyboard</a>}</div> : <div className="audio-empty video-empty"><Film size={34} /><p>The final Ella advert will play here when narration, visuals, typography and rendering are complete.</p></div>}
      </aside>
    </section>
  );
}
