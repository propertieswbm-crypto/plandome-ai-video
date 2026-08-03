"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, Link2, LoaderCircle, MonitorPlay, SlidersHorizontal, Sparkles, UserRound, WandSparkles } from "lucide-react";
import type { VideoJob } from "@/lib/video/types";

const terminal = new Set(["completed", "failed"]);

function previewScenes(value: string) {
  const clean = value.trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ");
  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter((part) => /[a-z0-9]/i.test(part)) ?? [];
  const beats = sentences.flatMap((sentence) => {
    if (sentence.split(/\s+/).length <= 15) return [sentence];
    const clauses = sentence.split(/(?<=,|;)\s+|\s+(?=(?:but|while|because|causing|particularly|as a result)\b)/i).map((part) => part.trim()).filter(Boolean);
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
  if (!text.trim()) throw new Error(`The server returned an empty response (${response.status || "connection interrupted"}).`);
  try { return JSON.parse(text) as T; } catch { throw new Error(`The server returned an invalid response (${response.status}).`); }
}

export function NarrationStudio() {
  const [script, setScript] = useState("");
  const [quality, setQuality] = useState<"preview" | "production">("preview");
  const [useAvatar, setUseAvatar] = useState(true);
  const [sceneMediaUrls, setSceneMediaUrls] = useState<string[]>([]);
  const [format, setFormat] = useState<"portrait" | "landscape" | "hz" | "sqr">("portrait");
  const [generateAllFormats, setGenerateAllFormats] = useState(true);
  const [job, setJob] = useState<VideoJob>();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
      if (attempt < 3) { timer.current = setTimeout(() => void poll(id, primary, attempt + 1), 1_500); return; }
      setError(cause instanceof Error ? cause.message : "Could not read render progress.");
    }
  }

  async function generate() {
    if (script.trim().length < 20 || jobs.some((item) => !terminal.has(item.status))) return;
    setError(undefined); setJob(undefined); setJobs([]);
    const allFormats: Array<"portrait" | "landscape" | "hz" | "sqr"> = ["portrait", "landscape", "hz", "sqr"];
    try {
      const formats = generateAllFormats ? allFormats : [format];
      const campaignId = crypto.randomUUID();
      const created = await Promise.all(formats.map(async (targetFormat) => {
        const response = await fetch("/api/v1/video-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            script,
            format: targetFormat,
            quality,
            useAvatar,
            sceneMediaUrls,
            renderer: "remotion",
            allowRendererFallback: false,
            campaignId,
            campaignFamily: targetFormat,
            variationSeed: crypto.randomUUID(),
          }),
        });
        const body = await readJson<VideoJob & { detail?: string }>(response);
        if (!response.ok) throw new Error(body.detail ?? `${targetFormat} video could not be created.`);
        return body;
      }));
      setJobs(created);
      setJob(created[0]);
      created.forEach((createdJob, index) => void poll(createdJob.id, index === 0));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Video jobs could not be created."); }
  }

  const busy = jobs.some((item) => !terminal.has(item.status));
  const scenes = previewScenes(script);
  return (
    <section className="studio-grid video-studio-grid">
      <div className="studio-panel">
        <div className="studio-panel-heading"><div><p className="kicker">Creative brief</p><h2>Start with your script</h2><p className="panel-description">The script controls every scene, visual and caption.</p></div><span className="character-count">{script.length.toLocaleString()} / 3,000</span></div>
        <div className="script-field"><textarea className="script-input video-script-input" value={script} onChange={(event) => setScript(event.target.value)} maxLength={3000} placeholder="Paste your UK property or planning advert script here…" aria-label="Video script" /><div className="script-hint"><WandSparkles size={14} /> Sentences are automatically matched to distinct UK visuals.</div></div>
        <div className="pipeline-summary">{useAvatar && <span><Check size={12} /> Ella hook</span>}<span><Check size={12} /> ElevenLabs voice</span><span><Check size={12} /> Scene-matched visuals</span><span><Check size={12} /> Animated captions</span></div>
        <label className={`avatar-toggle ${useAvatar ? "avatar-toggle-active" : ""}`}><input type="checkbox" checked={useAvatar} onChange={(event) => setUseAvatar(event.target.checked)} disabled={busy} /><span className="option-icon"><UserRound size={18} /></span><span><strong>Use Ella presenter</strong><small>{useAvatar ? "Ella presents the opening hook, then the advert moves into matched visuals." : "Faster creative: the full advert is produced without a presenter."}</small></span><span className="toggle-switch" aria-hidden="true" /></label>
        {scenes.length > 0 && <div className="scene-media-panel">
          <div className="scene-media-heading"><span className="option-icon"><Link2 size={18} /></span><span><strong>Use your own scene videos</strong><small>Optional. Paste a direct Google Drive or GoHighLevel video link to replace generation for that scene. The link must be publicly downloadable.</small></span></div>
          <div className="scene-media-list">
            {scenes.map((scene, index) => {
              const presenterScene = index === 0 && useAvatar;
              return <label key={`${index}-${scene.slice(0, 24)}`}>
                <span>Scene {index + 1}<small>{presenterScene ? "Ella presenter scene" : scene}</small></span>
                <input
                  type="url"
                  value={sceneMediaUrls[index] ?? ""}
                  onChange={(event) => setSceneMediaUrls((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })}
                  placeholder={presenterScene ? "Presenter generated automatically" : "https://drive.google.com/... or direct GoHighLevel video URL"}
                  disabled={busy || presenterScene}
                  aria-label={`Scene ${index + 1} video URL`}
                />
              </label>;
            })}
          </div>
        </div>}
        <div className="studio-controls">
          <label>Output format<select value={format} onChange={(event) => setFormat(event.target.value as "portrait" | "landscape" | "hz" | "sqr")} disabled={busy || generateAllFormats}><option value="portrait">9:16 · Social portrait</option><option value="landscape">16:9 · Landscape</option><option value="hz">16:9 (hz)</option><option value="sqr">1:1 (sqr)</option></select></label><label className="format-all-toggle"><input type="checkbox" checked={generateAllFormats} onChange={(event) => setGenerateAllFormats(event.target.checked)} disabled={busy} /> Generate one video for every format</label>
          <label>Render quality<select value={quality} onChange={(event) => setQuality(event.target.value as "preview" | "production")} disabled={busy}><option value="preview">Fast preview</option><option value="production">Production quality</option></select></label>
        </div>
        {error && <div className="form-message form-error" role="alert">{error}</div>}
        {job?.error && <div className="form-message form-error" role="alert">{job.error.message}</div>}
        <button className="button button-primary button-full button-large" type="button" onClick={generate} disabled={busy || script.trim().length < 20}>
          {busy ? <><LoaderCircle className="spin" size={18} /> {job?.stage}</> : <><Sparkles size={18} /> Generate complete video</>}
        </button>
        {job && <div className="job-progress" aria-live="polite"><div><span>{job.stage}</span><strong>{job.progress}%</strong></div><progress max="100" value={job.progress} /></div>}
      </div>
      <aside className="studio-panel preview-panel video-preview-panel">
        <div className="preview-heading"><div><p className="kicker">Live output</p><h2>Your finished advert</h2></div><span className="format-pill">9:16</span></div>
        {job?.status === "completed" && <div className="editor-optional-notice"><strong>Your video is ready here</strong><span>The editor opens only when you choose “Edit this video”.</span></div>}
        {job?.status === "completed" && job.outputUrl ? <div className="video-result"><video controls playsInline src={job.outputUrl} /><Link className="button button-primary button-full" href={`/video-editor?job=${job.id}`}><SlidersHorizontal size={17} /> Edit this video</Link><a className="button button-secondary button-full" href={job.outputUrl} download><Download size={17} /> Download MP4</a><a className="button button-secondary button-full" href={`/api/v1/canva/connect?job=${job.id}`} target="_blank" rel="noreferrer"><Link2 size={17} /> Open in Canva</a></div> : <div className="audio-empty video-empty"><div className="preview-device"><MonitorPlay size={30} /><span>1080 × 1920</span></div><h3>Your video appears here</h3><p>Generate a script-led advert, then review and download the finished MP4 from this panel.</p><div className="preview-steps"><span>01 · Analyse</span><span>02 · Produce</span><span>03 · Render</span></div></div>}
      </aside>
    </section>
  );
}
