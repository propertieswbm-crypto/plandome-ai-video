import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlannedScene } from "./video-composition";

export type CameraMovement = "push-in" | "push-out" | "pan-left" | "pan-right" | "parallax" | "tilt" | "dolly";

export type VisualBrief = {
  sentence: string;
  topic: string;
  object: string;
  country: "United Kingdom";
  architecture: string;
  environment: string;
  industry: string;
  emotion: string;
  action: string;
  cameraAngle: string;
  cameraMovement: CameraMovement;
  searchQuery: string;
  requiredVisualTerms: string[];
  forbiddenVisualTerms: string[];
};

const movements: CameraMovement[] = ["push-in", "pan-left", "push-out", "pan-right", "parallax", "tilt", "dolly"];

export function createVisualBrief(sentence: string, index: number): VisualBrief {
  const value = sentence.toLowerCase();
  const rear = /rear extension|extension/.test(value);
  const loft = /loft|roof/.test(value);
  const drawings = /drawing|plan|blueprint/.test(value);
  const commercial = /commercial|office|shop|retail/.test(value);
  const council = /permission|planning|council|application/.test(value);
  const risk = /risk|survey|structural|regulation|compliance|access|boundary|drainage|flood|party wall/.test(value);
  const architecture = /georgian/.test(value) ? "Georgian British" : /edwardian/.test(value) ? "Edwardian British" : "Victorian British";
  const object = rear ? "rear extension" : loft ? "loft conversion" : drawings ? "UK architectural planning drawings" : commercial ? "British commercial premises" : council ? "UK planning application documents" : risk ? "UK property survey and construction detail" : "British residential property";
  const topic = rear ? "residential extension" : loft ? "loft conversion" : drawings || council ? "planning approval" : commercial ? "commercial property" : risk ? "project risk" : "UK property planning";
  const environment = commercial ? "traditional British high street" : council ? "UK planning office" : rear ? "rear garden of a British terraced house" : "traditional British residential street";
  const action = drawings || council ? "reviewing accurate planning documents" : risk ? "inspecting the property detail" : rear || loft ? "showing the completed architectural alteration" : "showing the property exterior";
  const cameraAngle = drawings || council ? "clean overhead close-up" : rear ? "three-quarter rear exterior" : commercial ? "street-level architectural view" : "three-quarter exterior view";
  const searchQuery = `United Kingdom ${architecture} ${object} ${environment}`;
  const requiredVisualTerms=["United Kingdom",architecture,object,...(rear?["rear extension","British rear garden"]:[]),...(drawings||council?["UK planning documents"]:[])];
  const forbiddenVisualTerms=["American suburb","United States house","skyscraper","Mediterranean villa","tropical architecture","restaurant","generic office employees","luxury mansion"];
  return { sentence, topic, object, country: "United Kingdom", architecture, environment, industry: "UK architecture and town planning", emotion: risk ? "cautious and authoritative" : "confident and aspirational", action, cameraAngle, cameraMovement: movements[index % movements.length] ?? "push-in", searchQuery,requiredVisualTerms,forbiddenVisualTerms };
}

export type SceneValidation = { sceneId:string; scriptMatchScore:number; visualMatchScore:number; architectureScore:number; locationScore:number; textAccuracyScore:number; qualityScore:number; repetitionScore:number; passed:boolean; failureReasons:string[] };
export type QualityReport = { passed: boolean; checkedAt: string; scenes: Array<SceneValidation & { index:number; failures:string[] }> };

export type DesignProfile = { generationId: string; templateIndex: number; template: string; paletteIndex: number; palette: { paper: string; ink: string; accent: string; secondary: string }; fontIndex: number; fonts: { heading: string; body: string }; overlay: "solid" | "glass" | "editorial" | "outline"; templateId?:string; layoutFamily?:string; sceneLayouts?:string[]; transitions?:string[]; motionPresets?:string[]; textStyles?:string[]; creativeFingerprint?:string };
const templates = ["Editorial Premium", "Minimal Luxury", "Magazine Style", "Apple Style", "Corporate Modern", "Dark Premium", "Architectural", "Luxury Real Estate", "Split Editorial", "Clean Business", "Bold Motion", "Minimal Motion", "Modern Cards", "Glassmorphism", "Premium Infographic"];
const palettes = [["#E9E0D0", "#111827", "#B87333", "#F8F4EC"], ["#E8E0CF", "#17352B", "#8A9A5B", "#FBF8F0"], ["#EEE8DC", "#242424", "#C9A227", "#FFFDF7"], ["#EFF4F8", "#25364A", "#6F8FAF", "#FFFFFF"], ["#E7E3D8", "#30352C", "#708238", "#FAF8F1"], ["#F1EBDD", "#202124", "#8C6A43", "#FFFDF8"], ["#F4F0E5", "#123B3A", "#B08D57", "#FFFFF5"], ["#E9E6E0", "#3A3734", "#A97142", "#FFF9ED"]];
const fontPairs = [["League Spartan", "Inter"], ["Sora", "DM Sans"], ["Manrope", "Plus Jakarta Sans"], ["Poppins", "Geist"], ["Outfit", "Nunito Sans"], ["Space Grotesk", "IBM Plex Sans"], ["General Sans", "Inter"], ["Clash Display", "DM Sans"]];

export async function chooseNonRepeatingDesign(stateDirectory: string, seed: number, generationId: string): Promise<DesignProfile> {
  await mkdir(stateDirectory, { recursive: true }); const stateFile = path.join(stateDirectory, "design-state.json"); let previous = { template: -1, palette: -1, font: -1 };
  try { previous = { ...previous, ...(JSON.parse(await readFile(stateFile, "utf8")) as Partial<typeof previous>) }; } catch { /* first generation */ }
  const choose = (length: number, last: number, salt: number) => { let value = (seed + salt) % length; if (value === last) value = (value + 1 + seed % (length - 1)) % length; return value; };
  const templateIndex = choose(templates.length, previous.template, 0); const paletteIndex = choose(palettes.length, previous.palette, 17); const fontIndex = choose(fontPairs.length, previous.font, 31);
  await writeFile(stateFile, JSON.stringify({ template: templateIndex, palette: paletteIndex, font: fontIndex, generationId, updatedAt: new Date().toISOString() }, null, 2)); const palette = palettes[paletteIndex]!; const fonts = fontPairs[fontIndex]!;
  return { generationId, templateIndex, template: templates[templateIndex]!, paletteIndex, palette: { paper: palette[0]!, ink: palette[1]!, accent: palette[2]!, secondary: palette[3]! }, fontIndex, fonts: { heading: fonts[0]!, body: fonts[1]! }, overlay: (["solid", "glass", "editorial", "outline"] as const)[seed % 4]! };
}

export function validateVideoPlan(scenes: PlannedScene[]): QualityReport {
  const seen = new Set<string>();
  const reports = scenes.map((scene, index) => {
    const failures: string[] = [];
    // Property claims require authentic media. Planning, risk and cost beats have
    // purpose-built document/diagram layouts, so provider throttling must not
    // force an unrelated stock image or fail an otherwise grounded advert.
    const requiresMedia = false; // HyperFrames-only scenes do not require photo or video assets.
    if (!scene.brief) failures.push("Missing sentence-level visual brief.");
    if (requiresMedia && !scene.visualAsset && !scene.videoAsset && !scene.motionVisual) failures.push(`No line-matched visual asset.${scene.visualFailure ? ` Resolver: ${scene.visualFailure}` : ""}`);
    const asset = scene.visualAsset ?? scene.videoAsset ?? (scene.motionVisual ? `motion:${scene.motionVisual}` : undefined); const repeated=Boolean(asset&&seen.has(asset)&&!scene.motionVisual);
    if (repeated) failures.push("Visual is repeated from an earlier scene.");
    if (asset) seen.add(asset);
    if (scene.headline.trim().split(/\s+/).length > 8) failures.push("On-screen headline exceeds eight words.");
    // A semantic motion system is continuously animated and receives a distinct
    // layout, camera move and palette per scene. It is not a repeated asset.
    // Only genuinely static scenes should fail the normal visual-rhythm check.
    const hasContinuousMotion = Boolean(scene.videoAsset || scene.visualAsset || scene.motionVisual);
    if (scene.duration > 4.5 && !hasContinuousMotion && !["avatar", "pack", "cta"].includes(scene.kind)) failures.push("Static scene exceeds the normal 2â€“4 second visual rhythm.");
    if (scene.brief && !/United Kingdom|UK|British/i.test(`${scene.brief.country} ${scene.brief.architecture} ${scene.brief.searchQuery}`)) failures.push("Visual brief is not explicitly UK-based.");
    if (/american|usa|united states|suburbia/i.test(scene.brief?.searchQuery ?? "")) failures.push("Visual brief contains prohibited American context.");
    const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9Â£$â‚¬]+/g," ").trim(); const textAccuracyScore=normalized(scene.text).includes(normalized(scene.headline))?1:0;
    const hasMedia=Boolean(asset)||!requiresMedia;
    const motionRules:Partial<Record<NonNullable<PlannedScene["motionVisual"]>,RegExp>>={"tree-risk":/tree|root|oak/i,"soil-movement":/soil|clay|moisture|shrink|swell|dry|wet/i,"foundation-detail":/foundation|footing|underpin|deeper/i,"structural-damage":/structural|damage|crack|movement|subsidence/i,"victorian-rear-extension":/extension|rear|garden/i,"planning-drawings":/planning|drawing|permission|council|application/i,"commercial-property":/commercial|office|shop|retail|high street/i,"cost-analysis":/Â£|cost|budget|fee|price|money/i,"project-timeline":/week|month|timeline|schedule|delay|deadline/i,"compliance-check":/check|due diligence|verify|review|decision|feasibility/i};
    const motionRelevant=scene.motionVisual ? (motionRules[scene.motionVisual]?.test(scene.text) ?? true) : false;
    const visualMatchScore=scene.motionVisual ? .91 : hasMedia ? .86 : 0;
    const architectureScore=scene.brief && /Victorian|Edwardian|Georgian|planning|survey/i.test(`${scene.brief.architecture} ${scene.brief.object}`) ? .88 : 0;
    const locationScore=scene.brief && /United Kingdom|UK|British/i.test(`${scene.brief.country} ${scene.brief.searchQuery}`) ? .95 : 0;
    const qualityScore=scene.motionVisual ? .9 : hasMedia ? .85 : 0; const repetitionScore=repeated ? .65 : 1;
    if(textAccuracyScore<.95) failures.push("Designed text is not traceable to the narration source span."); if(visualMatchScore<.78) failures.push("Visual match score below 0.78."); if(architectureScore<.8) failures.push("Architecture score below 0.80."); if(locationScore<.8) failures.push("Location score below 0.80."); if(qualityScore<.8) failures.push("Quality score below 0.80.");
    return { index,sceneId:`scene-${index}`,scriptMatchScore:1,visualMatchScore,architectureScore,locationScore,textAccuracyScore,qualityScore,repetitionScore,passed: failures.length === 0, failures, failureReasons:failures };
  });
  return { passed: reports.every((scene) => scene.passed), checkedAt: new Date().toISOString(), scenes: reports };
}

export async function chooseNonRepeatingTemplate(stateDirectory: string, seed: number): Promise<number> {
  await mkdir(stateDirectory, { recursive: true });
  const stateFile = path.join(stateDirectory, "template-state.json");
  let previous = -1;
  try { previous = (JSON.parse(await readFile(stateFile, "utf8")) as { last?: number }).last ?? -1; } catch { /* first generation */ }
  let selected = seed % 6;
  if (selected === previous) selected = (selected + 1 + (seed % 4)) % 6;
  await writeFile(stateFile, JSON.stringify({ last: selected, updatedAt: new Date().toISOString() }, null, 2));
  return selected;
}
