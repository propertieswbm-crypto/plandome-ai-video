export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";
export type ApprovalState = "draft" | "planned" | "approved" | "rendering" | "completed" | "rejected";
export type StoryBeat = "hook" | "problem" | "escalation" | "proof" | "solution" | "offer" | "cta";
export type ShotSize = "wide" | "medium" | "close" | "detail" | "top" | "low" | "high";
export type CameraMove = "static" | "tracking" | "push" | "pull" | "orbit" | "reveal" | "parallax" | "rack-focus";
export type TrackKind = "video" | "narration" | "music" | "sfx" | "transition" | "caption" | "overlay" | "logo" | "lower-third" | "animation";
export type PipelineStage = "brief" | "story" | "storyboard" | "art-direction" | "assets" | "timeline" | "rendering" | "quality" | "export";
export type EditableElementType = "text" | "image" | "video" | "shape" | "logo" | "caption" | "document" | "report" | "blueprint" | "technical-annotation" | "price-badge" | "cta" | "contact-footer" | "gradient" | "line" | "group";
export type ElementAnimation = "none" | "fade" | "rise" | "slide" | "scale" | "mask-reveal" | "line-reveal" | "document-reveal";
export interface NormalizedBox { x:number; y:number; width:number; height:number; anchor:"top-left"|"top-center"|"top-right"|"center"|"bottom-left"|"bottom-center"|"bottom-right"; minWidth?:number; minHeight?:number; maxWidth?:number; maxHeight?:number; pin?:Array<"top"|"right"|"bottom"|"left">; }
export interface MediaTransform { fit:"cover"|"contain"|"fill"; crop:{ x:number;y:number;width:number;height:number }; focalPoint:{ x:number;y:number }; brightness:number; contrast:number; playbackRate:number; muted:boolean; trimStart:number; trimEnd?:number; }
export interface EditableElement {
  id:string; type:EditableElementType; name:string; role:string; semanticRole:string;
  rendererCompatibility:Array<"remotion"|"hyperframes">; visible:boolean; locked:boolean;
  start:number; end:number; layer:number; box:NormalizedBox; rotation:number; opacity:number;
  safeZone:{ top:number;right:number;bottom:number;left:number }; aspectOverrides?:Partial<Record<AspectRatio,Partial<NormalizedBox>>>;
  style:{ fontFamily?:string;fontWeight?:number;fontSize?:number;lineHeight?:number;letterSpacing?:number;textAlign?:"left"|"center"|"right";colour?:string;background?:string;borderRadius?:number;shadow?:string;textTransform?:"none"|"uppercase" };
  animation:{ type:ElementAnimation;duration:number;delay:number;intensity:number;easing:string };
  content?:string; assetId?:string; media?:MediaTransform; groupId?:string;
}

export interface CreativeBrief {
  audience: string;
  offer: string;
  goal: "awareness" | "consideration" | "conversion" | "education";
  platform: "tiktok" | "instagram-reels" | "youtube-shorts" | "meta-ads" | "web";
  tone: string[];
  brand: string;
  emotion: string;
  urgency: "low" | "medium" | "high";
  cta: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  visualStyle: string;
  contentCategory: string;
  propertyType?: string;
  planningCategory?: string;
  constructionCategory?: string;
  commercialCategory?: string;
  claims: string[];
  constraints: string[];
}

export interface Story {
  sourceScript: string;
  narrativeArc: StoryBeat[];
  beats: Array<{ id: string; beat: StoryBeat; narration: string; purpose: string }>;
}

export interface CameraPlan {
  shotSize: ShotSize;
  angle: "eye-level" | "top" | "low" | "high" | "aerial";
  move: CameraMove;
  subjectTracking: boolean;
  continuityNote: string;
}

export interface MotionPlan {
  intent: "calm" | "precise" | "urgent" | "reassuring" | "revealing" | "decisive";
  energy: number;
  entrance: string;
  emphasis: string;
  exit: string;
  easing: string;
}

export interface AssetRequirement {
  media: "video" | "image" | "graphic" | "document" | "avatar";
  subject: string;
  location: string;
  architecture?: string;
  mustInclude: string[];
  mustExclude: string[];
  minimumWidth: number;
  minimumHeight: number;
}

export interface AssetDecision {
  assetId: string;
  sceneId: string;
  uri: string;
  provider: string;
  mediaType: "video" | "image" | "audio";
  semanticScore: number;
  qualityScore: number;
  reason: string;
  license: string;
  sourceUrl?: string;
  checksum?: string;
}

export interface TemplateCapabilities {
  supportedMedia: Array<"video" | "image" | "graphic" | "document" | "avatar">;
  animationStyle: string;
  safeZones: { top: number; right: number; bottom: number; left: number };
  preferredDuration: [number, number];
  compatibleTransitions: string[];
  supportedCameraMoves: CameraMove[];
  maxCopyCharacters: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  categories: string[];
  capabilities: TemplateCapabilities;
  renderer: "hyperframes" | "remotion";
  component: string;
}

export interface DesignTokens {
  colours: { background: string; surface: string; text: string; muted: string; accent: string };
  typography: { heading: string; body: string; caption: string; scale: number[] };
  spacing: number[];
  radius: number;
  shadow: string;
}

export interface ArtDirection {
  id: string;
  name: string;
  rationale: string;
  tokens: DesignTokens;
  motionLanguage: string;
  cameraLanguage: string;
  captionStyle: string;
  overlayStyle: string;
  backgroundTreatment: string;
  animationTiming: string;
  iconography: string;
  brandTreatment: string;
  allowedTemplateCategories: string[];
}

export interface CreativeScene {
  id: string;
  order: number;
  beat: StoryBeat;
  narration: string;
  headline: string;
  purpose: string;
  visualDescription: string;
  referenceStyle: string;
  subject: string;
  foreground: string;
  background: string;
  camera: CameraPlan;
  motion: MotionPlan;
  transition: string;
  assetRequirements: AssetRequirement[];
  templateId: string;
  start: number;
  duration: number;
  locked: boolean;
  approved: boolean;
  regenerationRequested: boolean;
  enabled: boolean;
  selectedAssetId?: string;
  elements?: EditableElement[];
}

export interface TimelineClip {
  id: string;
  track: TrackKind;
  sceneId?: string;
  start: number;
  duration: number;
  sourceId?: string;
  payload: Record<string, unknown>;
}

export interface CaptionPhrase {
  id: string;
  sceneId: string;
  text: string;
  start: number;
  end: number;
  words: Array<{ text: string; start: number; end: number }>;
}

export interface AudioPlan {
  narration: { provider: string; voice: string; uri?: string; loudnessTargetLufs: number };
  music: { mood: string; uri?: string; levelDb: number; duckingDb: number };
  ambience: Array<{ sceneId: string; kind: string; levelDb: number; uri?: string }>;
  effects: Array<{ sceneId: string; kind: string; at: number; levelDb: number; uri?: string }>;
  pronunciation: Record<string, string>;
}

export interface QualityFinding {
  id: string;
  stage: "plan" | "asset" | "render";
  sceneId?: string;
  check: string;
  severity: "info" | "warning" | "error";
  message: string;
  repairAction?: string;
}

export interface PipelineCheckpoint {
  stage: PipelineStage;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  inputHash: string;
  completedAt?: string;
  error?: string;
}

export interface CreativeHistoryEntry {
  revision: number;
  timestamp: string;
  actor: "system" | "user";
  action: string;
  changes: string[];
}

export interface CreativeProject {
  schemaVersion: "1.0";
  id: string;
  jobId: string;
  projectId: string;
  version: number;
  approvalState: ApprovalState;
  createdAt: string;
  updatedAt: string;
  brief: CreativeBrief;
  story: Story;
  scenes: CreativeScene[];
  artDirection: ArtDirection;
  templates: TemplateDefinition[];
  assets: AssetDecision[];
  timeline: TimelineClip[];
  captions: CaptionPhrase[];
  audio: AudioPlan;
  brand: { name: string; logoUri: string; mandatory: boolean; phoneNumber?:string; colours?:{navy:string;cream:string;white:string;gold:string}; fontFamily?:string; ctaLabel?:string };
  transitions: string[];
  rendering: {
    engine: "hyperframes" | "remotion"; width: number; height: number; fps: number;
    quality: "preview" | "production"; variation?: {
      seed:string; fingerprint:string; profile:Record<string,unknown>;
    };
  };
  exports: Record<string, { uri: string; mimeType: string; createdAt: string }>;
  quality: QualityFinding[];
  checkpoints: PipelineCheckpoint[];
  history: CreativeHistoryEntry[];
}

export interface CreativeMemory {
  projectId: string;
  preferredTemplateIds: string[];
  preferredTransitions: string[];
  preferredTypography: string[];
  preferredPacing: "measured" | "balanced" | "fast";
  rejectedAssetIds: string[];
  updatedAt: string;
}
