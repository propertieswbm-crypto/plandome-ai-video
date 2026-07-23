import type {
  SceneCategory,
  SceneVisualPlan,
  VisualMode
} from "./universal-visual-planner";

export interface PremiumVisualResult {
  accepted: boolean;
  score: number;
  reasons: string[];
  revisedPrompt: string;
  revisedNegativePrompt: string;
  recommendedMode: VisualMode;
}

export interface VisualGenerationAttempt {
  sceneId: string;
  attempt: number;
  prompt: string;
  negativePrompt: string;
  seed?: number;
  outputPath?: string;
  success: boolean;
  failureReason?: string;
}

export const PREMIUM_REALISM_POLICY = {
  minimumScore: 82,
  maximumAttempts: 3,
  defaultMode: "ai_image_motion" as VisualMode,
  architectureMode: "ai_image_motion" as VisualMode,
  finalFallbackMode: "local_video" as VisualMode,
  neverUseCartoonFallback: true,
  neverUseCssIllustrations: true,
  neverUseGeneratedText: true,
  preferredSceneDurationSeconds: {
    minimum: 3,
    maximum: 5
  },
  finalOutput: {
    width: 1920,
    height: 1080,
    fps: 50,
    codec: "libx264",
    crf: 16,
    pixelFormat: "yuv420p"
  }
} as const;

const FORBIDDEN_VISUAL_TERMS = [
  "cartoon",
  "illustration",
  "vector",
  "flat design",
  "clip art",
  "anime",
  "comic",
  "low-poly",
  "toy building",
  "toy house",
  "css house",
  "css illustration",
  "plastic cgi",
  "game asset",
  "3d icon",
  "giant icon",
  "floating icon",
  "mascot",
  "emoji",
  "stylised property",
  "stylized property"
];

const REQUIRED_REALISM_TERMS = [
  "photorealistic",
  "cinematic",
  "commercial",
  "realistic",
  "natural lighting",
  "professional advertising"
];

export const GLOBAL_PREMIUM_NEGATIVE_PROMPT = [
  "cartoon",
  "illustration",
  "vector art",
  "flat design",
  "clip art",
  "anime",
  "comic style",
  "low-poly",
  "toy building",
  "toy house",
  "plastic CGI",
  "video game asset",
  "fake architecture",
  "stylised building",
  "distorted architecture",
  "warped walls",
  "bending walls",
  "duplicated windows",
  "duplicated doors",
  "changing roof",
  "changing building geometry",
  "melting objects",
  "floating objects",
  "deformed body",
  "deformed hands",
  "extra fingers",
  "duplicated people",
  "unreadable text",
  "generated text",
  "embedded captions",
  "watermark",
  "logo",
  "extreme saturation",
  "cheap stock look",
  "harsh HDR",
  "fisheye distortion",
  "extreme wide-angle distortion",
  "camera shake",
  "rapid zoom",
  "flicker",
  "frame inconsistency",
  "temporal inconsistency",
  "morphing background",
  "object mutation",
  "surreal environment"
].join(", ");

const CATEGORY_DIRECTION: Record<SceneCategory, string> = {
  property_exterior:
    "Authentic UK property exterior, accurate brickwork, real roof tiles, believable sash or modern windows, natural street environment, physically correct building proportions.",
  property_interior:
    "Authentic premium property interior, believable room proportions, real construction materials, natural window light, accurate joinery and architectural details.",
  construction:
    "Real professionally managed construction site, authentic tools and materials, accurate structural details, safe working environment, documentary commercial cinematography.",
  architecture:
    "Real architectural environment with physically accurate scale, materials, drawings and building geometry.",
  planning_documents:
    "Real architect or planner reviewing genuine-looking technical drawings and council correspondence in a premium UK studio; documents must not contain generated readable text.",
  commercial_business:
    "Real commercial premises, authentic operations, premium business cinematography and believable environmental details.",
  restaurant:
    "Real premium UK restaurant or commercial kitchen, stainless steel equipment, accurate extraction details, warm practical lighting and authentic hospitality environment.",
  office:
    "Real premium professional office, authentic business activity, restrained styling, believable technology and natural human movement.",
  finance:
    "Real professional reviewing credible figures and property information, premium office environment, restrained data overlays added later in post-production.",
  technology:
    "Real modern technology workspace, professional equipment, believable interfaces with no generated readable text, cinematic practical lighting.",
  education:
    "Real expert-led learning environment, authentic materials, professional presentation and restrained commercial cinematography.",
  professional_service:
    "Credible senior professional advising a client in a premium real-world consultation environment.",
  lifestyle:
    "Authentic aspirational lifestyle footage, natural human behaviour, believable location and premium commercial direction.",
  abstract_business:
    "Use a realistic visual metaphor filmed in a real environment rather than abstract animation or floating icons.",
  technical_explanation:
    "Show a real object, building detail, document, inspection or process, with technical overlays added later during composition.",
  before_after:
    "Use two stable photorealistic shots with matching perspective and architecture; do not morph the building between states.",
  brand_cta:
    "Use premium real footage or a restrained photographic background; add branding and CTA only during composition.",
  generic_real_world:
    "Choose a real, clearly filmable subject and authentic environment that directly communicates the narration."
};

function containsAny(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term));
}

function safeDuration(duration: number): number {
  if (!Number.isFinite(duration)) return 4;
  return Math.max(3, Math.min(5, duration));
}

export function choosePremiumVisualMode(
  category: SceneCategory,
  requiresReadableDocument = false
): VisualMode {
  if (requiresReadableDocument) return "local_video";

  switch (category) {
    case "property_exterior":
    case "property_interior":
    case "architecture":
    case "before_after":
    case "construction":
      return "ai_image_motion";

    case "planning_documents":
    case "finance":
    case "technology":
    case "technical_explanation":
      return "local_video";

    case "brand_cta":
      return "local_image_motion";

    default:
      return "ai_image_motion";
  }
}

export function buildPremiumPrompt(scene: SceneVisualPlan): string {
  const modeDirection =
    choosePremiumVisualMode(scene.category) === "ai_image_motion"
      ? "Create one stable high-detail photographic keyframe suitable for subtle image-to-video motion. Preserve all geometry throughout the shot."
      : "Create or select stable realistic commercial footage with controlled natural movement.";

  return [
    "Photorealistic cinematic commercial advertisement with natural lighting.",
    "Premium agency-quality professional advertising production.",
    CATEGORY_DIRECTION[scene.category],
    `Main subject: ${scene.subject}.`,
    `Environment: ${scene.environment}.`,
    `Visible action: ${scene.action}.`,
    `Shot: ${scene.shotType}.`,
    `Camera movement: ${scene.cameraMotion}.`,
    `Lighting: ${scene.lighting}.`,
    modeDirection,
    "Natural realistic colour grade.",
    "Authentic materials and physically accurate scale.",
    "Believable shadows, reflections and depth.",
    "Clear visual hierarchy with one main subject.",
    "Restrained camera movement.",
    "No generated text, captions, watermark or logo inside the visual.",
    "Branding, titles, diagrams and data overlays will be added separately in post-production.",
    "The result must look fully photographic and professionally filmed, with authentic real-world detail."
  ].join(" ");
}

export function validatePremiumScene(
  scene: SceneVisualPlan
): PremiumVisualResult {
  const reasons: string[] = [];
  let score = 100;

  const combined = [
    scene.visualPrompt,
    scene.subject,
    scene.environment,
    scene.action
  ].join(" ");

  const forbidden = containsAny(combined, FORBIDDEN_VISUAL_TERMS);

  if (forbidden.length > 0) {
    score -= Math.min(60, forbidden.length * 15);
    reasons.push(`Forbidden visual language: ${forbidden.join(", ")}`);
  }

  const missingRealism = REQUIRED_REALISM_TERMS.filter(
    (term) => !combined.toLowerCase().includes(term)
  );

  if (missingRealism.length > 0) {
    score -= missingRealism.length * 4;
    reasons.push(`Missing realism language: ${missingRealism.join(", ")}`);
  }

  if (!scene.subject || scene.subject.length < 12) {
    score -= 15;
    reasons.push("Main subject is too vague.");
  }

  if (!scene.environment || scene.environment.length < 12) {
    score -= 12;
    reasons.push("Environment is too vague.");
  }

  if (!scene.action || scene.action.length < 10) {
    score -= 12;
    reasons.push("Visible action is too vague.");
  }

  if (scene.durationSeconds < 2 || scene.durationSeconds > 6) {
    score -= 10;
    reasons.push("Scene duration is outside the safe advertising range.");
  }

  if (
    scene.visualMode === "typography" &&
    scene.category !== "brand_cta"
  ) {
    score -= 20;
    reasons.push("Typography-only visuals should not replace real footage.");
  }

  const recommendedMode = choosePremiumVisualMode(scene.category);

  if (
    scene.visualMode !== recommendedMode &&
    scene.visualMode !== "local_video" &&
    scene.visualMode !== "local_image_motion"
  ) {
    score -= 8;
    reasons.push(
      `Recommended visual mode for this category is ${recommendedMode}.`
    );
  }

  const revisedPrompt = buildPremiumPrompt({
    ...scene,
    durationSeconds: safeDuration(scene.durationSeconds),
    visualMode: recommendedMode
  });

  const revisedNegativePrompt = [
    GLOBAL_PREMIUM_NEGATIVE_PROMPT,
    scene.negativePrompt || ""
  ]
    .filter(Boolean)
    .join(", ");

  return {
    accepted: score >= PREMIUM_REALISM_POLICY.minimumScore,
    score: Math.max(0, score),
    reasons,
    revisedPrompt,
    revisedNegativePrompt,
    recommendedMode
  };
}

export function upgradeSceneForPremiumAd(
  scene: SceneVisualPlan
): SceneVisualPlan {
  const validation = validatePremiumScene(scene);

  return {
    ...scene,
    durationSeconds: safeDuration(scene.durationSeconds),
    visualMode: validation.recommendedMode,
    visualPrompt: validation.revisedPrompt,
    negativePrompt: validation.revisedNegativePrompt,
    generationAttempts: 0,
    status: "planned"
  };
}

export function upgradeAllScenesForPremiumAd(
  scenes: SceneVisualPlan[]
): SceneVisualPlan[] {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("At least one planned scene is required.");
  }

  return scenes.map(upgradeSceneForPremiumAd);
}

export function createRetryAttempt(
  scene: SceneVisualPlan,
  attempt: number,
  previousFailure?: string
): VisualGenerationAttempt {
  const safeAttempt = Math.max(1, Math.min(3, attempt));
  const retryDirection =
    safeAttempt === 1
      ? "Generate the requested shot exactly as described."
      : safeAttempt === 2
        ? "Simplify the composition to one stable subject, one environment and minimal movement. Prioritise realism and geometry."
        : "Use a static premium photographic composition with extremely subtle camera motion. Remove people unless essential.";

  return {
    sceneId: scene.sceneId,
    attempt: safeAttempt,
    prompt: [
      scene.visualPrompt,
      retryDirection,
      previousFailure
        ? `Correct the previous problem: ${previousFailure}.`
        : ""
    ]
      .filter(Boolean)
      .join(" "),
    negativePrompt: scene.negativePrompt,
    seed: Math.floor(Math.random() * 2147483646) + 1,
    success: false
  };
}

export function selectNoErrorFallback(
  scene: SceneVisualPlan,
  availableLocalVideo?: string,
  availableLocalImage?: string
): {
  mode: VisualMode;
  assetPath?: string;
  allowRender: boolean;
  reason: string;
} {
  if (availableLocalVideo) {
    return {
      mode: "local_video",
      assetPath: availableLocalVideo,
      allowRender: true,
      reason: "Using realistic local video fallback."
    };
  }

  if (availableLocalImage) {
    return {
      mode: "local_image_motion",
      assetPath: availableLocalImage,
      allowRender: true,
      reason: "Using realistic local photographic fallback."
    };
  }

  if (scene.category === "brand_cta") {
    return {
      mode: "typography",
      allowRender: true,
      reason: "Typography is permitted only for the final brand CTA."
    };
  }

  return {
    mode: "local_image_motion",
    allowRender: false,
    reason:
      "No realistic fallback asset exists. Cartoon or CSS illustration fallback is forbidden."
  };
}

export function assertNoCartoonFallback(
  mode: VisualMode,
  assetDescription = ""
): void {
  const forbidden = containsAny(
    `${mode} ${assetDescription}`,
    FORBIDDEN_VISUAL_TERMS
  );

  if (forbidden.length > 0) {
    throw new Error(
      `Render blocked because cartoon fallback was detected: ${forbidden.join(", ")}`
    );
  }
}

