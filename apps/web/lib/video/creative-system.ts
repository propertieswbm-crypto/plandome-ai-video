import { createHash, randomBytes, randomUUID } from "node:crypto";

export type VariationIdentity = { generationId: string; variationSeed: string; projectId: string };
export type VideoTemplate = { id: string; name: string; layoutFamily: string; textPosition: string; mediaPosition: string; captionStyle: string; overlayStyle: string; transitionPreset: string; motionPreset: string };
export type Palette = { id: string; background: string; surface: string; primaryText: string; secondaryText: string; accent: string; overlay: string; contrastScore: number; tags: string[] };
export type FontPair = { id: string; headingFont: string; bodyFont: string; headingWeight: number; bodyWeight: number; category: string; supportedCharacters: string[] };
export type CreativeSelection = { template: VideoTemplate; palette: Palette; fontPair: FontPair; sceneLayouts: string[]; transitions: string[]; motionPresets: string[]; textStyles: string[]; creativeFingerprint: string; rejectedTemplateIds: string[]; rejectedPaletteIds: string[]; rejectedFontPairIds: string[] };
export type GenerationHistory = { generationId: string; projectId: string; variationSeed: string; templateId: string; layoutFamily: string; paletteId: string; fontPairId: string; assetIds: string[]; sceneFingerprints: string[]; creativeFingerprint: string; createdAt: string };

export const templates: VideoTemplate[] = [
  ["editorial-split","Editorial Split","editorial-split","left","right","lower-third","paper","page-wipe","masked-reveal"],
  ["full-bleed","Full Bleed","full-bleed","bottom-left","full","boxed","gradient","focus-pull","push-in"],
  ["architectural-grid","Architectural Grid","architectural-grid","top-left","grid","rail","line-grid","grid-wipe","line-draw"],
  ["minimal-caption","Minimal Caption","minimal-caption","top-right","full","minimal","solid","cross-focus","pull-out"],
  ["magazine","Magazine","magazine","left-stack","offset-right","editorial","paper-cut","diagonal-wipe","pan-left"],
  ["document-overlay","Document Overlay","document-overlay","upper-left","document-stack","document","ink","document-slide","document-slide"],
  ["cinematic-property","Cinematic Property","cinematic-property","bottom","full","cinematic","vignette","focus-pull","dolly"],
  ["modern-cards","Modern Cards","modern-cards","card-left","card-right","pill","glass","card-stack","parallax"],
  ["right-rail","Right Rail","right-rail","right","left","side-rail","solid","vertical-push","pan-right"],
  ["topographic","Topographic","topographic","center-left","layered","floating","contour","iris","tilt"],
  ["blueprint","Blueprint","blueprint","top-left","blueprint-full","technical","blueprint","shutter","line-draw"],
  ["luxury-frame","Luxury Frame","luxury-frame","center-bottom","framed","serif-card","matte","color-dip","slow-push"],
].map(([id,name,layoutFamily,textPosition,mediaPosition,captionStyle,overlayStyle,transitionPreset,motionPreset]) => ({ id:String(id),name:String(name),layoutFamily:String(layoutFamily),textPosition:String(textPosition),mediaPosition:String(mediaPosition),captionStyle:String(captionStyle),overlayStyle:String(overlayStyle),transitionPreset:String(transitionPreset),motionPreset:String(motionPreset) }));

const rawPalettes = [
 ["midnight-copper","#101B2D","#F5EFE3","#F8F2E8","#B9C0CB","#B87333","#101B2DCC",8.9,"navy,copper,luxury"],
 ["forest-bronze","#17352B","#E7E0D2","#F7F3EA","#B6C2B6","#A97142","#17352BCC",8.7,"forest,bronze,heritage"],
 ["graphite-amber","#242424","#F4EBDD","#FFF9EF","#CFC5B6","#D99B2B","#242424CC",9.1,"graphite,amber,modern"],
 ["burgundy-charcoal","#541F2B","#F7F0E8","#FFF9F4","#D8C5C8","#2C2A2B","#541F2BCC",8.4,"burgundy,editorial"],
 ["slate-copper","#334A62","#F3EBDD","#FFFFFF","#C8D1DA","#C47A44","#334A62CC",8.6,"slate,copper"],
 ["teal-champagne","#123B3A","#DED8CA","#FFFDF5","#BAC7C3","#C7A86B","#123B3ACC",9.0,"teal,champagne"],
 ["olive-stone","#4D5539","#D8D1C2","#FFFCF4","#C7C9B9","#A88452","#4D5539CC",8.2,"olive,stone"],
 ["charcoal-gold","#1E2022","#E7DDCB","#FFF9EC","#BDB7AC","#C9A227","#1E2022CC",9.3,"charcoal,gold"],
 ["oxford-blue","#162A46","#E8E0CF","#FFFDF7","#B8C4D2","#C58A55","#162A46CC",9.0,"british,formal"],
 ["brick-cream","#6D3028","#F2E4D0","#FFF8ED","#D8BFB5","#B86E3F","#6D3028CC",8.4,"brick,victorian"],
 ["ink-parchment","#182126","#E9DFC8","#FFF9E9","#BAC1C2","#8E6F45","#182126CC",9.1,"document,planning"],
 ["plum-stone","#43313F","#E8E0D6","#FFF9F3","#CBBFC9","#AD765A","#43313FCC",8.7,"plum,luxury"],
 ["moss-ivory","#344334","#EEE8DA","#FFFCF3","#C4CDBF","#B28B57","#344334CC",8.8,"moss,heritage"],
 ["navy-coral","#17243B","#F0E9DF","#FFFFFF","#C4CBD5","#D8755B","#17243BCC",9.0,"navy,modern"],
 ["espresso-sand","#332821","#E2D3BD","#FFF8EB","#C7B9A8","#C08A53","#332821CC",8.9,"warm,property"],
 ["pewter-sage","#374345","#DDE2D4","#FCFFF7","#C4CEC8","#91A477","#374345CC",8.6,"sage,contemporary"],
];
export const palettes: Palette[] = rawPalettes.map(([id,background,surface,primaryText,secondaryText,accent,overlay,contrastScore,tags]) => ({id:String(id),background:String(background),surface:String(surface),primaryText:String(primaryText),secondaryText:String(secondaryText),accent:String(accent),overlay:String(overlay),contrastScore:Number(contrastScore),tags:String(tags).split(",")}));

export const fontPairs: FontPair[] = [
 ["archivo-plex","Archivo Black","IBM Plex Mono",900,400,"architectural"], ["libre-archivo","Libre Franklin","Archivo Black",900,400,"editorial"],
 ["montserrat-plex","Montserrat","IBM Plex Sans",900,300,"corporate"], ["urbanist-plex","Urbanist","IBM Plex Mono",900,400,"modern"],
 ["manrope-mono","Manrope","IBM Plex Mono",800,400,"minimal"], ["space-libre","Space Grotesk","Libre Franklin",700,300,"magazine"],
 ["archivo-libre","Archivo","Libre Franklin",900,300,"institutional"], ["plex-archivo","IBM Plex Sans","Archivo Black",700,400,"technical"],
 ["jakarta-mono","Plus Jakarta Sans","IBM Plex Mono",800,400,"premium"], ["dm-archivo","DM Sans","Archivo Black",900,400,"clean"],
 ["sora-plex","Sora","IBM Plex Mono",800,400,"geometric"], ["outfit-libre","Outfit","Libre Franklin",900,300,"property"],
].map(([id,headingFont,bodyFont,headingWeight,bodyWeight,category]) => ({id:String(id),headingFont:String(headingFont),bodyFont:String(bodyFont),headingWeight:Number(headingWeight),bodyWeight:Number(bodyWeight),category:String(category),supportedCharacters:["latin"]}));

export function createVariationIdentity(projectId = "plandome-company"): VariationIdentity { return { generationId: randomUUID(), variationSeed: randomBytes(16).toString("hex"), projectId }; }
function hash(seed: string, label: string) { return Number.parseInt(createHash("sha256").update(`${seed}:${label}`).digest("hex").slice(0, 12), 16); }
export function seededOrder<T>(values: T[], seed: string, label: string): T[] { return [...values].sort((a,b) => hash(seed, `${label}:${JSON.stringify(a)}`) - hash(seed, `${label}:${JSON.stringify(b)}`)); }
function selectFresh<T extends {id:string}>(values:T[], excluded:Set<string>, seed:string, label:string) { return seededOrder(values.filter(v=>!excluded.has(v.id)).length ? values.filter(v=>!excluded.has(v.id)) : values,seed,label)[0]!; }
export function selectCreative(identity: VariationIdentity, recent: GenerationHistory[], sceneCount: number): CreativeSelection {
 const last3=recent.slice(0,3); const template=selectFresh(templates,new Set(last3.map(x=>x.templateId)),identity.variationSeed,"template");
 const palette=selectFresh(palettes,new Set(recent.slice(0,3).map(x=>x.paletteId)),identity.variationSeed,"palette"); const fontPair=selectFresh(fontPairs,new Set(recent.slice(0,3).map(x=>x.fontPairId)),identity.variationSeed,"font");
 const layouts=seededOrder(templates.map(x=>x.layoutFamily),identity.variationSeed,"layouts").slice(0,Math.max(sceneCount,1)); while(layouts.length<sceneCount) layouts.push(...layouts);
 const transitions=seededOrder(["page-wipe","focus-pull","vertical-push","diagonal-wipe","document-slide","color-dip"],identity.variationSeed,"transitions");
 const motions=seededOrder(["push-in","pull-out","pan-left","pan-right","parallax","masked-reveal","line-draw","dolly"],identity.variationSeed,"motions");
 const textStyles=seededOrder(["boxed","editorial","rail","minimal","document","cinematic"],identity.variationSeed,"text");
 const payload={templateId:template.id,paletteId:palette.id,fontPairId:fontPair.id,sceneLayouts:layouts.slice(0,sceneCount),transitions,motionPresets:motions,textStyles};
 return {template,palette,fontPair,sceneLayouts:payload.sceneLayouts,transitions,motionPresets:motions,textStyles,creativeFingerprint:createHash("sha256").update(JSON.stringify(payload)).digest("hex"),rejectedTemplateIds:last3.map(x=>x.templateId),rejectedPaletteIds:recent.slice(0,3).map(x=>x.paletteId),rejectedFontPairIds:recent.slice(0,3).map(x=>x.fontPairId)};
}
