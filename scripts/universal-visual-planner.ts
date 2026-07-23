export type VisualMode =
  | "ai_video"
  | "ai_image_motion"
  | "local_video"
  | "local_image_motion"
  | "typography"
  | "technical_overlay";

export type SceneCategory =
  | "property_exterior"
  | "property_interior"
  | "construction"
  | "architecture"
  | "planning_documents"
  | "commercial_business"
  | "restaurant"
  | "office"
  | "finance"
  | "technology"
  | "education"
  | "professional_service"
  | "lifestyle"
  | "abstract_business"
  | "technical_explanation"
  | "before_after"
  | "brand_cta"
  | "generic_real_world";

export interface SceneVisualPlan {
  sceneId: string;
  narration: string;
  durationSeconds: number;
  category: SceneCategory;
  visualMode: VisualMode;
  subject: string;
  environment: string;
  action: string;
  shotType: string;
  cameraMotion: string;
  lighting: string;
  visualPrompt: string;
  negativePrompt: string;
  fallbackSearchTerms: string[];
  fallbackCategory: SceneCategory;
  headline?: string;
  overlayStyle: "none" | "minimal" | "blueprint" | "data" | "document";
  generationAttempts: number;
  status: "planned" | "generating" | "ready" | "fallback" | "failed";
}

const GLOBAL_NEGATIVE_PROMPT = [
  "cartoon",
  "illustration",
  "vector art",
  "flat design",
  "clip art",
  "anime",
  "stylised house",
  "plastic CGI",
  "toy building",
  "game asset",
  "low-poly",
  "distorted architecture",
  "warped walls",
  "duplicated windows",
  "duplicated doors",
  "changing building geometry",
  "melting objects",
  "deformed people",
  "extra fingers",
  "unreadable text",
  "embedded captions",
  "watermark",
  "logo",
  "excessive saturation",
  "fisheye distortion",
  "flicker",
  "temporal inconsistency",
  "morphing background"
].join(", ");

const CATEGORY_RULES: Array<{
  category: SceneCategory;
  words: string[];
  subject: string;
  environment: string;
  action: string;
  overlayStyle: SceneVisualPlan["overlayStyle"];
}> = [
    {
      category: "planning_documents",
      words: ["planning", "approval", "council", "permission", "application", "consent"],
      subject: "an experienced architectural professional reviewing detailed planning documents",
      environment: "a premium contemporary UK architectural studio",
      action: "carefully comparing drawings, requirements and official correspondence",
      overlayStyle: "document"
    },
    {
      category: "construction",
      words: ["builder", "construction", "build", "structural", "steel", "foundation", "roof"],
      subject: "a real construction detail with authentic building materials",
      environment: "an active professionally managed UK construction site",
      action: "being inspected and measured by a qualified construction professional",
      overlayStyle: "blueprint"
    },
    {
      category: "restaurant",
      words: ["restaurant", "cafe", "takeaway", "kitchen", "extract", "flue", "odour"],
      subject: "a premium commercial kitchen and extraction installation",
      environment: "a realistic modern UK restaurant fit-out",
      action: "being professionally inspected before installation",
      overlayStyle: "blueprint"
    },
    {
      category: "property_interior",
      words: ["loft", "interior", "room", "staircase", "insulation", "ventilation"],
      subject: "a realistic high-quality UK property interior",
      environment: "an authentic residential conversion project",
      action: "showing practical architectural and construction details",
      overlayStyle: "blueprint"
    },
    {
      category: "property_exterior",
      words: ["property", "house", "home", "garage", "extension", "commercial", "building", "conversion"],
      subject: "an authentic British property with accurate architectural details",
      environment: "a real UK street with natural surroundings",
      action: "shown as premium professional property advertising footage",
      overlayStyle: "minimal"
    },
    {
      category: "finance",
      words: ["profit", "value", "gdv", "investment", "finance", "cost", "wealth", "return"],
      subject: "a professional property investor reviewing credible project figures",
      environment: "a premium real-world business office",
      action: "analysing valuation and development information",
      overlayStyle: "data"
    },
    {
      category: "technology",
      words: ["technology", "software", "platform", "automation", "digital", "system", "ai"],
      subject: "a professional using a modern digital platform",
      environment: "a realistic premium technology workspace",
      action: "reviewing clear operational information on screen",
      overlayStyle: "data"
    },
    {
      category: "education",
      words: ["learn", "education", "course", "training", "programme", "guide"],
      subject: "an experienced professional explaining a practical concept",
      environment: "a premium real-world learning and consultation environment",
      action: "reviewing relevant examples and supporting material",
      overlayStyle: "document"
    },
    {
      category: "professional_service",
      words: ["consultation", "expert", "professional", "team", "service", "assessment"],
      subject: "a credible senior professional advising a client",
      environment: "a premium consultation room with authentic business details",
      action: "discussing a clear practical route forward",
      overlayStyle: "minimal"
    },
    {
      category: "office",
      words: ["office", "workspace", "desk", "meeting", "consultant", "team"],
      subject: "a premium professional office environment",
      environment: "a realistic UK business workspace",
      action: "reviewing property and planning information",
      overlayStyle: "minimal"
    },
    {
      category: "lifestyle",
      words: ["family", "home", "neighbourhood", "garden", "lifestyle", "residential"],
      subject: "a warm British residential property setting",
      environment: "an attractive UK neighbourhood street",
      action: "showing everyday family life around a premium property",
      overlayStyle: "minimal"
    },
    {
      category: "technical_explanation",
      words: ["technical", "regulations", "inspection", "drainage", "flood", "compliance"],
      subject: "a detailed technical construction explanation",
      environment: "a professional UK building site environment",
      action: "presenting practical compliance and risk information",
      overlayStyle: "data"
    },
    {
      category: "before_after",
      words: ["before", "after", "renovation", "conversion", "transformation", "improvement"],
      subject: "a British property before and after renovation",
      environment: "a realistic UK residential development",
      action: "revealing the transformation from planning to completion",
      overlayStyle: "blueprint"
    },
    {
      category: "brand_cta",
      words: ["contact", "book", "download", "decision", "call", "visit", "start"],
      subject: "a clear marketing call to action for a property service",
      environment: "a premium UK business communications setting",
      action: "inviting the viewer to take a confident next step",
      overlayStyle: "minimal"
    },
    {
      category: "abstract_business",
      words: ["development", "project", "vision", "masterplan", "strategy", "proposal"],
      subject: "a polished commercial development concept",
      environment: "a premium corporate property planning environment",
      action: "presenting a high-level property project narrative",
      overlayStyle: "data"
    }
  ];

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitScript(script: string): string[] {
  const cleaned = script.replace(/\r/g, "").trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const scenes: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const proposed = current ? `${current} ${sentence}` : sentence;
    const words = proposed.split(/\s+/).length;

    if (words > 22 && current) {
      scenes.push(current);
      current = sentence;
    } else {
      current = proposed;
    }
  }

  if (current) scenes.push(current);

  return scenes;
}

function inferCategory(text: string) {
  const lower = normalise(text);

  let best = CATEGORY_RULES[CATEGORY_RULES.length - 1];
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    const score = rule.words.reduce(
      (total, word) => total + (lower.includes(word) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  if (bestScore === 0) {
    return {
      category: "generic_real_world" as SceneCategory,
      words: [],
      subject: "a credible real-world subject directly representing the narration",
      environment: "an authentic premium commercial environment",
      action: "performing a clear visually understandable action",
      overlayStyle: "minimal" as SceneVisualPlan["overlayStyle"]
    };
  }

  return best;
}

function durationFromNarration(narration: string): number {
  const wordCount = narration.split(/\s+/).filter(Boolean).length;
  const estimated = wordCount / 2.6;
  return Math.max(3, Math.min(6, Number(estimated.toFixed(1))));
}

function cameraForCategory(category: SceneCategory): string {
  switch (category) {
    case "property_exterior":
      return "subtle slow cinematic dolly forward";
    case "property_interior":
      return "slow controlled interior tracking shot";
    case "construction":
      return "steady close-detail camera movement";
    case "planning_documents":
      return "restrained overhead-to-close-up camera move";
    case "finance":
    case "technology":
      return "smooth professional lateral camera move";
    default:
      return "subtle controlled commercial camera movement";
  }
}

function shotForCategory(category: SceneCategory): string {
  switch (category) {
    case "property_exterior":
      return "wide architectural establishing shot";
    case "property_interior":
      return "medium-wide interior architectural shot";
    case "construction":
      return "cinematic close-up detail shot";
    case "planning_documents":
      return "overhead desk shot with realistic shallow depth of field";
    case "finance":
      return "medium professional office shot";
    default:
      return "premium medium commercial advertising shot";
  }
}

function buildPrompt(
  narration: string,
  rule: ReturnType<typeof inferCategory>
): string {
  return [
    "Photorealistic cinematic commercial footage.",
    `${rule.subject}.`,
    `${rule.environment}.`,
    `${rule.action}.`,
    `The visual must clearly represent this narration: "${narration}".`,
    "Authentic materials, believable scale, physically accurate geometry and natural lighting.",
    "Professional advertising cinematography with realistic depth of field.",
    `${shotForCategory(rule.category)}.`,
    `${cameraForCategory(rule.category)}.`,
    "Restrained premium colour grade.",
    "No text, captions, watermark or company logo inside the generated visual.",
    "Must look like real footage rather than an illustration or graphic."
  ].join(" ");
}

export function planVisualScenes(script: string): SceneVisualPlan[] {
  if (!script || !script.trim()) {
    throw new Error("A non-empty script is required.");
  }

  return splitScript(script).map((narration, index) => {
    const rule = inferCategory(narration);

    return {
      sceneId: `scene-${String(index + 1).padStart(2, "0")}`,
      narration,
      durationSeconds: durationFromNarration(narration),
      category: rule.category,
      visualMode: "ai_image_motion",
      subject: rule.subject,
      environment: rule.environment,
      action: rule.action,
      shotType: shotForCategory(rule.category),
      cameraMotion: cameraForCategory(rule.category),
      lighting: "natural cinematic lighting with realistic shadows",
      visualPrompt: buildPrompt(narration, rule),
      negativePrompt: GLOBAL_NEGATIVE_PROMPT,
      fallbackSearchTerms: [
        rule.category.replace(/_/g, " "),
        rule.subject,
        rule.environment
      ],
      fallbackCategory: rule.category,
      overlayStyle: rule.overlayStyle,
      generationAttempts: 0,
      status: "planned"
    };
  });
}
