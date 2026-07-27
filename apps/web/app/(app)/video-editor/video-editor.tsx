"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, Download, Eye, EyeOff, Film, Image, LayoutTemplate, LoaderCircle, Music2, Play, Plus, Save, Shapes, SlidersHorizontal, Sparkles, Text, Undo2, Upload, ZoomIn } from "lucide-react";
import type { VideoJob } from "@/lib/video/types";

type CameraMove = "static" | "tracking" | "push" | "pull" | "orbit" | "reveal" | "parallax" | "rack-focus";
type ShotSize = "wide" | "medium" | "close" | "detail" | "top" | "low" | "high";
type SceneEdit = { id: string; text: string; duration: number; enabled: boolean; locked?: boolean; regenerationRequested?: boolean; templateId?: string | undefined; assetUri?: string | undefined; cameraMove?: CameraMove; shotSize?: ShotSize };
type Preferences = { captionScale: number; overlayOpacity: number; logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right"; logoScale: number; pacing: "measured" | "balanced" | "fast"; notes: string };
type EditProject = { jobId: string; scenes: SceneEdit[]; preferences: Preferences; revision: number; updatedAt: string };
const defaults: Preferences = { captionScale: 1, overlayOpacity: .82, logoPosition: "top-left", logoScale: 1, pacing: "balanced", notes: "" };
const splitScenes = (script: string) => script.match(/[^.!?]+[.!?]?/g)?.map((value) => value.trim()).filter(Boolean) ?? [script];
const editorTools = [
  [LayoutTemplate, "Design"], [Shapes, "Elements"], [Text, "Text"],
  [Image, "Media"], [Upload, "Uploads"], [Music2, "Audio"],
] as const;

export function VideoEditor() {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<VideoJob>();
  const [scenes, setScenes] = useState<SceneEdit[]>([]);
  const [preferences, setPreferences] = useState(defaults);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("job");
    if (id) { setJobId(id); void load(id); }
  }, []);

  async function load(id = jobId) {
    if (!id) return;
    setBusy(true); setStatus(undefined);
    try {
      const response = await fetch(`/api/v1/video-jobs/${id}/edits`, { cache: "no-store" });
      const body = await response.json() as { job?: VideoJob; edits?: EditProject | null; detail?: string };
      if (!response.ok || !body.job) throw new Error(body.detail ?? "Video could not be loaded.");
      setJob(body.job);
      if (body.edits) { setScenes(body.edits.scenes); setPreferences(body.edits.preferences); }
      else setScenes(splitScenes(body.job.input.script).map((text, index) => ({ id: `scene-${String(index + 1).padStart(2, "0")}`, text, duration: 3, enabled: true, locked:false, regenerationRequested:false, cameraMove:"push", shotSize:"medium" })));
      setSelected(0); setStatus("Project loaded");
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Video could not be loaded."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!job) return;
    setBusy(true); setStatus(undefined);
    try {
      const response = await fetch(`/api/v1/video-jobs/${job.id}/edits`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id, scenes, preferences, revision: 0, updatedAt: new Date().toISOString() }),
      });
      const body = await response.json() as EditProject & { detail?: string };
      if (!response.ok) throw new Error(body.detail ?? "Changes could not be saved.");
      setStatus(`Saved revision ${body.revision}. Future generations will use these preferences.`);
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Changes could not be saved."); }
    finally { setBusy(false); }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    setScenes((current) => { const next = [...current]; [next[index], next[target]] = [next[target]!, next[index]!]; return next; });
    setSelected(target);
  }

  const active = scenes[selected];
  const totalDuration = useMemo(() => scenes.filter((scene) => scene.enabled).reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  return (
    <div className="canva-editor">
      <header className="canva-topbar">
        <div className="canva-topbar-brand"><button aria-label="Back"><ChevronLeft size={18} /></button><span className="canva-mark"><Sparkles size={16} /></span><div><strong>Plandome Studio</strong><small>{job ? `Video · ${job.id.slice(0, 8)}` : "Untitled video"}</small></div></div>
        <div className="editor-project-loader"><input value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="Paste video job ID" aria-label="Video job ID" /><button className="button button-secondary" onClick={() => void load()} disabled={busy || !jobId}>{busy ? <LoaderCircle className="spin" size={16} /> : <Film size={16} />} Load</button></div>
        <div className="canva-topbar-actions"><button title="Undo"><Undo2 size={17} /></button><span>{status ?? "All changes saved"}</span><button className="canva-share" onClick={() => void save()} disabled={!job || busy}><Save size={15} /> Save</button><button title="Download"><Download size={17} /></button></div>
      </header>
      <section className="editor-shell canva-shell">
        <nav className="canva-toolrail" aria-label="Editor tools">
          {editorTools.map(([Icon, label], index) => <button key={label} className={index === 0 ? "active" : ""}><Icon size={21} /><span>{label}</span></button>)}
        </nav>
        <aside className="canva-library">
          <div className="canva-library-title"><strong>Design</strong><button><Plus size={16} /></button></div>
          <div className="canva-search">Search templates and styles</div>
          <p>Scenes</p>
          <div className="canva-page-list">
            {scenes.map((scene, index) => <button key={scene.id} className={selected === index ? "active" : ""} onClick={() => setSelected(index)}>
              <span className="canva-page-thumb"><b>{String(index + 1).padStart(2, "0")}</b><i /></span>
              <span><strong>Scene {index + 1}</strong><small>{scene.text}</small></span>
            </button>)}
          </div>
        </aside>
        <div className="editor-preview-panel">
          <div className="canva-canvas-toolbar"><button>Animate</button><button>Position</button><button><SlidersHorizontal size={14} /> Adjust</button><span /><button><ZoomIn size={14} /> 54%</button></div>
          <div className="editor-video-stage">
            {job?.outputUrl ? <video ref={video} src={job.outputUrl} controls playsInline /> : <div className="editor-placeholder"><Play size={34} /><span>Load a completed video to begin</span></div>}
            {job?.outputUrl && active?.enabled && <div className="editor-caption-preview" style={{ fontSize: `${Math.round(30 * preferences.captionScale)}px`, background: `rgba(7,11,18,${preferences.overlayOpacity})` }}>{active.text}</div>}
            {job?.outputUrl && <img className={`editor-logo-preview logo-${preferences.logoPosition}`} style={{ transform: `scale(${preferences.logoScale})` }} src="/brand/plandome-logo.png" alt="Plandome" />}
          </div>
          <div className="editor-transport"><button className="canva-play" onClick={() => void video.current?.play()}><Play size={15} /></button><strong>00:00</strong><span>/ {totalDuration.toFixed(1)} sec</span><i /><span>{scenes.filter((scene) => scene.enabled).length} pages</span></div>
          <div className="editor-timeline"><div className="timeline-playhead" />{scenes.map((scene, index) => <button key={scene.id} className={`timeline-clip ${selected === index ? "timeline-clip-active" : ""} ${scene.enabled ? "" : "timeline-clip-disabled"}`} style={{ flexGrow: scene.duration }} onClick={() => setSelected(index)}><strong>{index + 1}</strong><span>{scene.text}</span><small>{scene.duration.toFixed(1)}s</small></button>)}<button className="timeline-add"><Plus size={18} /></button></div>
        </div>
        <aside className="editor-inspector">
          <div className="editor-inspector-heading"><SlidersHorizontal size={18} /><div><strong>Inspector</strong><span>Scene and brand controls</span></div></div>
          {active ? <div className="editor-control-stack">
            <div className="editor-scene-actions"><button onClick={() => move(selected, -1)} disabled={selected === 0} aria-label="Move scene up"><ArrowUp size={16} /></button><button onClick={() => move(selected, 1)} disabled={selected === scenes.length - 1} aria-label="Move scene down"><ArrowDown size={16} /></button><button onClick={() => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, enabled: !scene.enabled } : scene))}>{active.enabled ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>
            <label>On-screen copy<textarea value={active.text} maxLength={500} onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, text: event.target.value } : scene))} /></label>
            <label>Scene duration <output>{active.duration.toFixed(1)} sec</output><input type="range" min="1" max="12" step=".25" value={active.duration} onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, duration: Number(event.target.value) } : scene))} /></label>
            <label>Replace asset URL<input value={active.assetUri ?? ""} placeholder="https://..." onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, assetUri:event.target.value || undefined } : scene))} /></label>
            <label>Template<select value={active.templateId ?? ""} onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, templateId:event.target.value || undefined } : scene))}><option value="">Semantic default</option><option value="luxury-property">Luxury property</option><option value="paper-documentary">Paper documentary</option><option value="technical-blueprint">Technical blueprint</option><option value="premium-corporate">Premium corporate</option><option value="minimal-explainer">Minimal explainer</option><option value="testimonial-proof">Case study / proof</option><option value="brand-cta">Brand CTA</option></select></label>
            <label>Camera move<select value={active.cameraMove ?? "push"} onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, cameraMove:event.target.value as CameraMove } : scene))}>{["static","tracking","push","pull","orbit","reveal","parallax","rack-focus"].map((value)=><option key={value}>{value}</option>)}</select></label>
            <label>Shot size<select value={active.shotSize ?? "medium"} onChange={(event) => setScenes((current) => current.map((scene, index) => index === selected ? { ...scene, shotSize:event.target.value as ShotSize } : scene))}>{["wide","medium","close","detail","top","low","high"].map((value)=><option key={value}>{value}</option>)}</select></label>
            <div className="editor-scene-actions"><button onClick={() => setScenes((current) => current.map((scene,index)=>index===selected?{...scene,locked:!scene.locked}:scene))}>{active.locked ? "Unlock scene" : "Lock scene"}</button><button onClick={() => setScenes((current) => current.map((scene,index)=>index===selected?{...scene,regenerationRequested:true}:scene))}>Regenerate scene</button></div>
            <hr />
            <label>Caption scale <output>{Math.round(preferences.captionScale * 100)}%</output><input type="range" min=".7" max="1.5" step=".05" value={preferences.captionScale} onChange={(event) => setPreferences({ ...preferences, captionScale: Number(event.target.value) })} /></label>
            <label>Overlay strength <output>{Math.round(preferences.overlayOpacity * 100)}%</output><input type="range" min=".25" max="1" step=".05" value={preferences.overlayOpacity} onChange={(event) => setPreferences({ ...preferences, overlayOpacity: Number(event.target.value) })} /></label>
            <label>Logo position<select value={preferences.logoPosition} onChange={(event) => setPreferences({ ...preferences, logoPosition: event.target.value as Preferences["logoPosition"] })}><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
            <label>Pacing<select value={preferences.pacing} onChange={(event) => setPreferences({ ...preferences, pacing: event.target.value as Preferences["pacing"] })}><option value="measured">Measured</option><option value="balanced">Balanced</option><option value="fast">Fast</option></select></label>
            <label>Creative notes<textarea value={preferences.notes} maxLength={2000} placeholder="What should future videos learn?" onChange={(event) => setPreferences({ ...preferences, notes: event.target.value })} /></label>
          </div> : <p className="editor-inspector-empty">Choose a video project to reveal editing controls.</p>}
          {status && <div className={`editor-save-status ${status.startsWith("Saved") ? "editor-save-success" : ""}`}>{status.startsWith("Saved") && <Check size={14} />}{status}</div>}
          <button className="button button-primary button-full" onClick={() => void save()} disabled={!job || busy}><Save size={16} /> Save & teach generator</button>
        </aside>
      </section>
    </div>
  );
}
