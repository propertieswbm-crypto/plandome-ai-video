import type {
  ArtDirection, CameraMove, CaptionPhrase, CreativeBrief, CreativeMemory, CreativeProject,
  CreativeScene, PipelineStage, QualityFinding, ShotSize, StoryBeat, TemplateDefinition, TimelineClip,
} from "./types";

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function includes(text: string, expression: RegExp) { return expression.test(text.toLowerCase()); }
function title(text: string) {
  const words = text.replace(/[?!.,]/g, "").trim().split(/\s+/).slice(0, 7);
  return words.join(" ");
}

export type CreativeFormat = "portrait" | "landscape" | "hz" | "sqr";
type RenderFormat = CreativeFormat;

const aspectRatioForFormat = (format: RenderFormat): CreativeBrief["aspectRatio"] => {
  if (format === "landscape" || format === "hz") return "16:9";
  if (format === "sqr") return "1:1";
  return "9:16";
};

const renderingDimensionsForFormat = (format: RenderFormat) => {
  const aspectRatio = aspectRatioForFormat(format);
  return aspectRatio === "16:9" ? { width: 1920, height: 1080 }
    : aspectRatio === "1:1" ? { width: 1080, height: 1080 }
      : { width: 1080, height: 1920 };
};

const safeZoneDescription = (format: RenderFormat) => {
  if (format === "sqr") return "Respect square safe zones.";
  if (format === "landscape" || format === "hz") return "Respect horizontal safe zones.";
  return "Respect vertical safe zones.";
};

export function interpretBrief(script: string, format: RenderFormat, durationSeconds: number): CreativeBrief {
  const property = includes(script, /loft|roof/) ? "Victorian or period UK loft" :
    includes(script, /commercial|office|shop|retail/) ? "UK commercial property" :
    includes(script, /extension|house|home|property/) ? "UK residential property" : undefined;
  const planning = includes(script, /planning|permission|council|application/) ? "UK planning and permission" : undefined;
  const construction = includes(script, /build|construction|structural|foundation|engineer/) ? "Construction and structural delivery" : undefined;
  const commercial = includes(script, /commercial|office|shop|retail/) ? "Commercial property" : undefined;
  const ctaMatch = script.match(/(?:book|download|get|contact|visit|call|request|start)[^.!?]{0,90}/i)?.[0];
  const claims = [...script.matchAll(/(?:£|\$|€)\s?[\d,.]+|\b\d+(?:\.\d+)?%|\b\d+\s+(?:days?|weeks?|months?|years?)/gi)].map((match) => match[0]);
  return {
    audience: property ? "UK property owners, developers and decision makers" : "Business decision makers",
    offer: ctaMatch ?? "A clear, expert-led next step",
    goal: ctaMatch ? "conversion" : includes(script, /how|why|understand|explain/) ? "education" : "consideration",
    platform: "instagram-reels",
    tone: ["premium", "architectural", "authoritative", "clear"],
    brand: "Plandome",
    emotion: includes(script, /risk|cost|mistake|refus/) ? "concern resolved through expert clarity" : "confidence",
    urgency: includes(script, /now|today|before|risk|cost|delay/) ? "high" : "medium",
    cta: ctaMatch ?? "Speak with Plandome",
    durationSeconds,
    aspectRatio: aspectRatioForFormat(format),
    visualStyle: property ? "premium architectural documentary" : "premium editorial commercial",
    contentCategory: property ? "property and planning" : "professional services",
    ...(property ? { propertyType: property } : {}),
    ...(planning ? { planningCategory: planning } : {}),
    ...(construction ? { constructionCategory: construction } : {}),
    ...(commercial ? { commercialCategory: commercial } : {}),
    claims,
    constraints: ["Plandome logo required", "UK context required", "No generic or irrelevant property imagery", safeZoneDescription(format)],
  };
}

function beatFor(index: number, count: number, text: string): StoryBeat {
  if (index === 0) return "hook";
  if (index === count - 1) return "cta";
  if (includes(text, /proof|result|approved|experience|report|evidence|survey/)) return "proof";
  if (includes(text, /solution|review|assessment|plan|check|expert/)) return "solution";
  if (includes(text, /offer|pack|£|\$|book|free/)) return "offer";
  if (includes(text, /risk|cost|delay|refus|mistake|damage/)) return index < count / 2 ? "problem" : "escalation";
  return index < count / 2 ? "problem" : "solution";
}

const purposes: Record<StoryBeat, string> = {
  hook: "Stop attention and establish immediate relevance",
  problem: "Make the audience recognise the problem",
  escalation: "Show the consequence of inaction",
  proof: "Build credibility with evidence",
  solution: "Present the expert route forward",
  offer: "Make the value and next step tangible",
  cta: "Prompt one clear action",
};

export function cameraFor(index: number, beat: StoryBeat): { shotSize: ShotSize; move: CameraMove } {
  const sizes: ShotSize[] = ["wide", "medium", "detail", "close", "top", "low", "high"];
  const moves: CameraMove[] = ["reveal", "tracking", "push", "parallax", "pull", "orbit", "rack-focus"];
  if (beat === "cta") return { shotSize: "medium", move: "push" };
  return { shotSize: sizes[index % sizes.length]!, move: moves[index % moves.length]! };
}

export const templateRegistry: TemplateDefinition[] = [
  ["technical-blueprint", "Technical Blueprint", ["technical", "construction", "blueprint"], ["video","image","graphic","document"], "precise line reveals", ["wipe","draw","match-cut"], ["push","tracking","parallax"], "BlueprintScene"],
  ["paper-documentary", "Paper Documentary", ["paper","documentary","planning","case-study"], ["video","image","document"], "layered editorial paper", ["paper-slide","mask","crossfade"], ["push","pull","parallax"], "PaperDocumentaryScene"],
  ["luxury-property", "Luxury Property", ["luxury","property","architectural"], ["video","image"], "restrained cinematic editorial", ["crossfade","mask","light-leak"], ["tracking","push","reveal"], "LuxuryPropertyScene"],
  ["premium-corporate", "Premium Corporate", ["corporate","financial","comparison"], ["video","image","graphic"], "clean modular motion", ["wipe","crossfade","match-cut"], ["static","push","tracking"], "PremiumCorporateScene"],
  ["minimal-explainer", "Minimal Explainer", ["explainer","minimal","map"], ["video","image","graphic","document"], "calm explanatory motion", ["wipe","crossfade"], ["push","pull","parallax"], "MinimalExplainerScene"],
  ["testimonial-proof", "Testimonial Proof", ["testimonial","proof","case-study"], ["video","image","avatar","document"], "evidence-led editorial reveal", ["crossfade","mask"], ["push","rack-focus","reveal"], "TestimonialScene"],
  ["brand-cta", "Brand CTA", ["cta","offer"], ["video","image","graphic","avatar"], "decisive branded close", ["brand-wipe","crossfade"], ["push","static"], "BrandCtaScene"],
].map(([id, name, categories, media, animation, transitions, moves, component]) => ({
  id: String(id), name: String(name), categories: categories as string[],
  capabilities: {
    supportedMedia: media as TemplateDefinition["capabilities"]["supportedMedia"],
    animationStyle: String(animation), safeZones: { top: 0.08, right: 0.06, bottom: 0.12, left: 0.06 },
    preferredDuration: [2.5, 8], compatibleTransitions: transitions as string[],
    supportedCameraMoves: moves as CameraMove[], maxCopyCharacters: 100,
  },
  renderer: "hyperframes" as const, component: String(component),
}));

function chooseTemplate(beat: StoryBeat, brief: CreativeBrief, text: string, memory?: CreativeMemory) {
  if (beat === "cta") return templateRegistry.find((item) => item.id === "brand-cta")!;
  const wanted = [
    ...(includes(text, /drawing|plan|structural|construction|foundation/) ? ["technical","construction"] : []),
    ...(includes(text, /document|report|permission|council|application/) ? ["planning","documentary"] : []),
    ...(brief.propertyType ? ["property","architectural"] : []),
    ...(includes(text, /proof|result|approved|evidence/) ? ["proof","case-study"] : []),
    ...(includes(text, /cost|budget|price|comparison/) ? ["financial","comparison"] : []),
  ];
  const ranked = templateRegistry.map((template) => ({
    template,
    score: template.categories.filter((category) => wanted.includes(category)).length * 10 +
      (memory?.preferredTemplateIds.includes(template.id) ? 3 : 0),
  })).sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
  return ranked[0]!.template;
}

export function compileArtDirection(brief: CreativeBrief, seed: string): ArtDirection {
  const property = Boolean(brief.propertyType);
  const palettes = property
    ? [
        { background:"#071A2D", surface:"#F7F3EA", text:"#FFFFFF", muted:"#B9C4CC", accent:"#D6A85A" },
        { background:"#161816", surface:"#EEEAE1", text:"#FAF8F2", muted:"#BEB9AE", accent:"#B88A52" },
      ]
    : [
        { background:"#0A1420", surface:"#F4F6F8", text:"#FFFFFF", muted:"#AEB8C2", accent:"#61C4FF" },
        { background:"#151515", surface:"#F4F1E9", text:"#FFFFFF", muted:"#BAB5AC", accent:"#E6B566" },
      ];
  const colours = palettes[hash(seed) % palettes.length]!;
  return {
    id: `art-${hash(`${seed}:${brief.visualStyle}`).toString(16)}`,
    name: property ? "Architectural Editorial" : "Premium Corporate Editorial",
    rationale: `Selected for ${brief.contentCategory}, ${brief.goal} and ${brief.emotion}.`,
    tokens: {
      colours,
      typography: { heading: "Arial", body: "Arial", caption: "Arial", scale: [16,20,28,44,72,96] },
      spacing: [8,12,16,24,32,48,64,96], radius: property ? 4 : 18,
      shadow: "0 24px 70px rgba(0,0,0,.22)",
    },
    motionLanguage: "cinematic, restrained and purpose-led",
    cameraLanguage: "varied editorial coverage with continuity",
    captionStyle: "phrase captions with active-word emphasis",
    overlayStyle: property ? "editorial gradient" : "subtle glass",
    backgroundTreatment: property ? "architectural depth and soft directional light" : "soft gradient lighting",
    animationTiming: "natural ease with 180-650ms hierarchy",
    iconography: "minimal line iconography",
    brandTreatment: "Plandome remains visible inside protected safe zones",
    allowedTemplateCategories: property ? ["property","architectural","planning","construction","documentary","cta"] : ["corporate","minimal","explainer","cta"],
  };
}

export function createCreativeProject(input: {
  id: string; jobId: string; projectId: string; script: string; segments: string[];
  durationSeconds: number; format: CreativeFormat; quality: "preview" | "production";
  seed: string; memory?: CreativeMemory;
}): CreativeProject {
  const now = new Date().toISOString();
  const brief = interpretBrief(input.script, input.format, input.durationSeconds);
  const { width, height } = renderingDimensionsForFormat(input.format);
  const artDirection = compileArtDirection(brief, input.seed);
  const rawDurations = input.segments.map((text) => Math.max(1, text.length));
  const totalWeight = rawDurations.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  const beats = input.segments.map((narration, index) => {
    const beat = beatFor(index, input.segments.length, narration);
    return { id: `beat-${index + 1}`, beat, narration, purpose: purposes[beat] };
  });
  const scenes: CreativeScene[] = beats.map((item, index) => {
    const duration = index === beats.length - 1
      ? Math.max(2.5, input.durationSeconds - cursor)
      : input.durationSeconds * (rawDurations[index]! / totalWeight);
    const camera = cameraFor(index, item.beat);
    const template = chooseTemplate(item.beat, brief, item.narration, input.memory);
    const scene: CreativeScene = {
      id: `scene-${String(index + 1).padStart(2, "0")}`, order: index, beat: item.beat,
      narration: item.narration, headline: title(item.narration), purpose: item.purpose,
      visualDescription: `${brief.visualStyle}; ${item.purpose}; visually explain: ${item.narration}`,
      referenceStyle: artDirection.name, subject: brief.propertyType ?? brief.contentCategory,
      foreground: "One purposeful focal element", background: artDirection.backgroundTreatment,
      camera: {
        ...camera, angle: camera.shotSize === "low" ? "low" : camera.shotSize === "high" ? "high" : camera.shotSize === "top" ? "top" : "eye-level",
        subjectTracking: camera.move === "tracking" || camera.move === "orbit",
        continuityNote: index === 0 ? "Establish the visual world" : "Change shot size and movement while preserving subject and screen direction",
      },
      motion: {
        intent: item.beat === "hook" ? "revealing" : item.beat === "cta" ? "decisive" : includes(item.narration,/risk|cost|delay/) ? "urgent" : "precise",
        energy: item.beat === "hook" || item.beat === "cta" ? 0.75 : 0.5,
        entrance: item.beat === "hook" ? "cinematic reveal" : "masked editorial entrance",
        emphasis: "single focal hierarchy", exit: "directional transition", easing: "cubic-bezier(.22,1,.36,1)",
      },
      transition: template.capabilities.compatibleTransitions[index % template.capabilities.compatibleTransitions.length]!,
      assetRequirements: [{
        media: item.beat === "cta" ? "graphic" : "video", subject: brief.propertyType ?? brief.contentCategory,
        location: brief.propertyType ? "United Kingdom" : "brand appropriate",
        ...(brief.propertyType ? { architecture: brief.propertyType } : {}),
        mustInclude: brief.propertyType ? ["UK context", ...item.narration.toLowerCase().split(/\W+/).filter((word) => word.length > 6).slice(0,3)] : [],
        mustExclude: ["generic stock aesthetic", "wrong country", "logos from other brands", "low resolution", "duplicate composition"],
        ...(input.format === "sqr"
          ? { minimumWidth: 1080, minimumHeight: 1080 }
          : input.format === "landscape" || input.format === "hz"
            ? { minimumWidth: 1920, minimumHeight: 1080 }
            : { minimumWidth: 1080, minimumHeight: 1920 }),
      }],
      templateId: template.id, start: cursor, duration, locked: false, approved: false,
      regenerationRequested: false, enabled: true,
    };
    cursor += duration;
    return scene;
  });
  const project: CreativeProject = {
    schemaVersion: "1.0", id: input.id, jobId: input.jobId, projectId: input.projectId,
    version: 1, approvalState: "planned", createdAt: now, updatedAt: now, brief,
    story: { sourceScript: input.script, narrativeArc: beats.map((item) => item.beat), beats },
    scenes, artDirection, templates: templateRegistry, assets: [], timeline: buildTimeline(scenes, []),
    captions: [], audio: {
      narration: { provider: "elevenlabs", voice: "ella", loudnessTargetLufs: -16 },
      music: { mood: brief.emotion, levelDb: -23, duckingDb: -9 },
      ambience: scenes.filter((scene) => scene.beat !== "cta").map((scene) => ({ sceneId:scene.id, kind: includes(scene.narration,/construction|build/) ? "construction" : "architectural room tone", levelDb:-31 })),
      effects: scenes.map((scene) => ({ sceneId:scene.id, kind:scene.beat === "cta" ? "cta-sting" : "transition", at:scene.start, levelDb:-18 })),
      pronunciation: { Plandome: "Plan-dome" },
    },
    brand: { name:"Plandome", logoUri:"assets/logo.png", mandatory:true, phoneNumber:"+44 7835 397683", fontFamily:"Montserrat", ctaLabel:"Book your Plandome review", colours:{navy:"#071A2D",cream:"#F5F0E6",white:"#FFFDF8",gold:"#B9975B"} },
    transitions: [...new Set(scenes.map((scene) => scene.transition))],
    rendering: { engine:"hyperframes", width, height, fps:30, quality:input.quality },
    exports:{}, quality:evaluatePlan(scenes), checkpoints: [
      "brief","story","storyboard","art-direction","assets","timeline","rendering","quality","export",
    ].map((stage) => ({ stage:stage as PipelineStage, status:["brief","story","storyboard","art-direction","timeline"].includes(stage) ? "completed" : "pending", attempts:0, inputHash:hash(`${input.script}:${stage}`).toString(16), ...(["brief","story","storyboard","art-direction","timeline"].includes(stage) ? { completedAt:now } : {}) })),
    history:[{ revision:1, timestamp:now, actor:"system", action:"project-created", changes:["brief","story","storyboard","artDirection","timeline"] }],
  };
  return project;
}

export function buildTimeline(scenes: CreativeScene[], captions: CaptionPhrase[]): TimelineClip[] {
  const clips: TimelineClip[] = [];
  for (const scene of scenes.filter((item) => item.enabled)) {
    clips.push({ id:`video-${scene.id}`, track:"video", sceneId:scene.id, start:scene.start, duration:scene.duration, payload:{ templateId:scene.templateId, camera:scene.camera, motion:scene.motion } });
    clips.push({ id:`overlay-${scene.id}`, track:"overlay", sceneId:scene.id, start:scene.start, duration:scene.duration, payload:{ purpose:scene.purpose } });
    clips.push({ id:`logo-${scene.id}`, track:"logo", sceneId:scene.id, start:scene.start, duration:scene.duration, payload:{ protected:true } });
    clips.push({ id:`transition-${scene.id}`, track:"transition", sceneId:scene.id, start:Math.max(0,scene.start-.25), duration:.5, payload:{ name:scene.transition } });
  }
  for (const caption of captions) clips.push({ id:`caption-${caption.id}`, track:"caption", sceneId:caption.sceneId, start:caption.start, duration:caption.end-caption.start, payload:{ phraseId:caption.id, activeWord:true } });
  const duration = scenes.reduce((max, scene) => Math.max(max, scene.start + scene.duration), 0);
  clips.push({ id:"narration-main", track:"narration", start:0, duration, payload:{ role:"primary" } });
  clips.push({ id:"music-main", track:"music", start:0, duration, payload:{ duckUnderNarration:true } });
  return clips.sort((a,b) => a.start-b.start || a.track.localeCompare(b.track));
}

export function phraseCaptions(project: CreativeProject, words: Array<{ text:string; start:number; end:number }>): CaptionPhrase[] {
  const phrases: CaptionPhrase[] = [];
  for (const scene of project.scenes) {
    const sceneWords = words.filter((word) => word.start >= scene.start-.05 && word.start < scene.start+scene.duration);
    for (let index=0; index<sceneWords.length; index+=6) {
      const group = sceneWords.slice(index,index+6);
      if (!group.length) continue;
      phrases.push({ id:`${scene.id}-phrase-${Math.floor(index/6)+1}`, sceneId:scene.id, text:group.map((word)=>word.text).join(" "), start:group[0]!.start, end:group.at(-1)!.end, words:group });
    }
  }
  return phrases;
}

export function evaluatePlan(scenes: CreativeScene[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  scenes.forEach((scene,index) => {
    if (scene.headline.length > 100) findings.push({ id:`copy-${scene.id}`,stage:"plan",sceneId:scene.id,check:"copy-length",severity:"warning",message:"Headline exceeds premium template capacity.",repairAction:"Shorten headline." });
    if (index > 0 && scene.camera.shotSize === scenes[index-1]!.camera.shotSize) findings.push({ id:`camera-${scene.id}`,stage:"plan",sceneId:scene.id,check:"camera-variety",severity:"warning",message:"Consecutive scenes repeat shot size.",repairAction:"Select a different shot size." });
    if (!scene.assetRequirements[0]?.mustExclude.includes("wrong country")) findings.push({ id:`geo-${scene.id}`,stage:"plan",sceneId:scene.id,check:"geography",severity:"error",message:"Scene lacks geographic rejection constraints." });
  });
  return findings;
}

export function recordCheckpoint(project: CreativeProject, stage: PipelineStage, status: "running"|"completed"|"failed", error?: string) {
  const checkpoint = project.checkpoints.find((item) => item.stage === stage);
  if (!checkpoint) return;
  checkpoint.status = status;
  if (status === "running") checkpoint.attempts += 1;
  if (status === "completed") checkpoint.completedAt = new Date().toISOString();
  if (error) checkpoint.error = error;
  project.updatedAt = new Date().toISOString();
}

export function mutateProject(project: CreativeProject, mutation: {
  actor:"user"|"system"; action:string; sceneId?:string; changes:Partial<Pick<CreativeScene,"narration"|"headline"|"duration"|"enabled"|"locked"|"approved"|"regenerationRequested"|"templateId"|"camera"|"motion">>;
}) {
  if (mutation.sceneId) {
    const scene = project.scenes.find((item) => item.id === mutation.sceneId);
    if (!scene) throw new Error(`Scene ${mutation.sceneId} was not found.`);
    Object.assign(scene, mutation.changes);
  }
  project.version += 1;
  project.updatedAt = new Date().toISOString();
  project.timeline = buildTimeline(project.scenes, project.captions);
  project.history.push({ revision:project.version,timestamp:project.updatedAt,actor:mutation.actor,action:mutation.action,changes:Object.keys(mutation.changes) });
}
