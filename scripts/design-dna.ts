export type DesignDNA = {
  creativeDirection: string;
  layoutPhilosophy: string;
  motionLanguage: string;
  typographySystem: string;
  cameraLanguage: string;
  transitionLanguage: string;
  colorStrategy: string;
  texturePack: string;
  depthSystem: string;
  lightingStyle: string;
  graphicLanguage: string;
  overlayStyle: string;
  ctaStyle: string;
  animationCurve: string;
  spacingRule: string;
  visualRhythm: string;
};

export type ProductionComponent =
  | "hero-layout" | "floating-cards" | "kinetic-type" | "product-reveal"
  | "dashboard" | "chart" | "statistics" | "split-screen"
  | "feature-cards" | "animated-icons" | "browser-window" | "cursor"
  | "device-mockup" | "reviews" | "pricing" | "timeline"
  | "progress-bar" | "lower-third" | "media-frame" | "brand-cta";

const choices = {
  creativeDirection: ["architectural editorial", "cinematic documentary", "precision technology", "tactile modernism", "luxury restraint"],
  layoutPhilosophy: ["asymmetric editorial grid", "product-led full bleed", "modular bento rhythm", "layered spatial collage", "Swiss information hierarchy"],
  motionLanguage: ["weighted spring choreography", "cinematic inertia", "precise kinetic geometry", "layered paper mechanics", "elegant restrained drift"],
  typographySystem: ["display-led editorial contrast", "modern grotesk hierarchy", "high-fashion serif contrast", "technical mono accents", "geometric product typography"],
  cameraLanguage: ["slow dolly and detail reveals", "parallax tracking", "controlled push and pull", "overhead object choreography", "wide-to-macro progression"],
  transitionLanguage: ["masked spatial handoffs", "object-matched cuts", "editorial page turns", "depth wipes", "light and focus bridges"],
  colorStrategy: ["restrained neutral with one signal accent", "deep tonal field with metallic highlight", "warm paper with architectural ink", "cool product neutrals", "monochrome with material contrast"],
  texturePack: ["fine film grain", "subtle paper tooth", "polished glass", "architectural tracing paper", "clean matte"],
  depthSystem: ["three-plane parallax", "floating card stack", "shallow cinematic focus", "layered material shadows", "restrained spatial elevation"],
  lightingStyle: ["soft directional daylight", "controlled studio gradient", "warm practical contrast", "cool edge lighting", "diffused editorial light"],
  graphicLanguage: ["architectural annotations", "precision rules and indices", "editorial crops", "modular interface cards", "bold typographic framing"],
  overlayStyle: ["frosted information rail", "opaque editorial block", "fine outlined panel", "soft tonal gradient", "material label"],
  ctaStyle: ["confident editorial lockup", "product card reveal", "minimal action rail", "cinematic brand resolve", "high-contrast button stage"],
  animationCurve: ["expo.out", "power3.inOut", "back.out(1.2)", "sine.inOut", "circ.out"],
  spacingRule: ["8-point disciplined grid", "generous editorial whitespace", "dense modular rhythm", "cinematic safe-zone framing", "asymmetric proportional spacing"],
  visualRhythm: ["hook-pause-accelerate-resolve", "measured editorial cadence", "progressive visual escalation", "alternating wide and detail", "fast proof points with calm resolve"],
} satisfies Record<keyof DesignDNA, string[]>;

function hash(value: string) {
  let output = 2166136261;
  for (const character of value) { output ^= character.charCodeAt(0); output = Math.imul(output, 16777619); }
  return output >>> 0;
}
export function buildDesignDNA(seed: string): DesignDNA {
  return Object.fromEntries(Object.entries(choices).map(([key, values]) => [
    key,
    values[hash(`${seed}:${key}`) % values.length],
  ])) as DesignDNA;
}

const componentRecipes: ProductionComponent[][] = [
  ["hero-layout", "floating-cards", "kinetic-type", "product-reveal"],
  ["dashboard", "chart", "statistics", "brand-cta"],
  ["split-screen", "feature-cards", "animated-icons", "lower-third"],
  ["browser-window", "cursor", "media-frame", "product-reveal"],
  ["device-mockup", "reviews", "pricing", "brand-cta"],
  ["timeline", "progress-bar", "feature-cards", "lower-third"],
];

export function composeSceneComponents(seed: string, sceneCount: number): ProductionComponent[][] {
  const offset = hash(`${seed}:recipes`) % componentRecipes.length;
  return Array.from({ length: sceneCount }, (_, index) => componentRecipes[(offset + index) % componentRecipes.length]!)
}

export function reviewCreative(sceneComponents: ProductionComponent[][]) {
  const failures: string[] = [];
  if (!sceneComponents.length) failures.push("No scenes were composed.");
  if (sceneComponents.some((components) => components.length < 3)) failures.push("Every scene needs a layered component composition.");
  const fingerprints = sceneComponents.map((components) => components.join(":"));
  if (new Set(fingerprints).size !== fingerprints.length && fingerprints.length <= componentRecipes.length) failures.push("A scene composition was repeated.");
  return { passed: failures.length === 0, failures };
}
