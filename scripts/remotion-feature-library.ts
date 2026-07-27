export type TemplateFeature =
  | "photo-stack"
  | "split-screen"
  | "polaroid"
  | "lower-third"
  | "kinetic-type"
  | "cinematic-mask"
  | "floating-cards"
  | "media-frame"
  | "number-counter"
  | "progress-rail"
  | "light-leak"
  | "brand-outro";

export const templateFeatureLibrary: TemplateFeature[] = [
  "photo-stack",
  "split-screen",
  "polaroid",
  "lower-third",
  "kinetic-type",
  "cinematic-mask",
  "floating-cards",
  "media-frame",
  "number-counter",
  "progress-rail",
  "light-leak",
  "brand-outro",
];

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/**
 * Every video receives the full feature grammar. Features are distributed
 * across scenes in a seeded order, so they feel composed rather than stacked.
 */
export function assignTemplateFeatures(seed: string, scenes: Array<{ kind:string; text:string }>): TemplateFeature[][] {
  return scenes.map((scene,index) => {
    const value = scene.text.toLowerCase();
    const features:TemplateFeature[] = [];
    if (index === 0) features.push("cinematic-mask","lower-third");
    if (/before|after|compare|versus|difference/.test(value)) features.push("split-screen");
    if (/document|report|planning|permission|application|evidence/.test(value)) features.push("photo-stack");
    if (/number|cost|£|\$|percent|%|days|weeks|months/.test(value)) features.push("number-counter");
    if (/testimonial|client|said|review/.test(value)) features.push("polaroid");
    if (/steps|process|timeline|stage/.test(value)) features.push("progress-rail");
    if (/interface|dashboard|software|data/.test(value)) features.push("floating-cards");
    if (scene.kind === "cta" || index === scenes.length-1) features.push("brand-outro");
    if (!features.length) features.push(hash(`${seed}:${index}`)%2 ? "media-frame" : "lower-third");
    return [...new Set(features)].slice(0,2);
  });
}
