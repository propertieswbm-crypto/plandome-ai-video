/**
 * Premium Visual Variety Engine
 *
 * Ensures every video generation has unique layout, camera movement,
 * transition style, subtitle animation, font pairing, color grading,
 * timing, scene composition, motion style, intro, and outro.
 *
 * Never generates two videos with the same visual flow.
 */

import { createHash } from "node:crypto";
import { CAMERA_PRESETS, type CameraPresetName } from "./premium-cinematic-motion";

export type CameraMovement = CameraPresetName;

/** All valid camera preset names from the cinematic motion engine */
const CAMERA_MOVEMENTS: CameraPresetName[] = Object.keys(CAMERA_PRESETS) as CameraPresetName[];

// ─── Visual Identity Types ────────────────────────────────────────────

export type VisualIdentity = {
    /** Unique fingerprint for this generation */
    fingerprint: string;
    /** Scene-level randomisation */
    sceneVariations: SceneVariation[];
    /** Global visual style */
    globalStyle: GlobalVisualStyle;
    /** Transition sequence */
    transitions: TransitionProfile[];
    /** Typography system */
    typography: TypographySystem;
    /** Motion system */
    motionSystem: MotionSystem;
    /** Color grading LUT simulation */
    colorGrade: ColorGrade;
    /** Intro/outro style */
    introOutro: IntroOutroStyle;
};

export type SceneVariation = {
    sceneIndex: number;
    layout: LayoutStyle;
    cameraMovement: CameraMovement;
    transitionIn: TransitionType;
    transitionOut: TransitionType;
    subtitleAnimation: SubtitleAnimation;
    compositionStyle: CompositionStyle;
    motionIntensity: number; // 0.3 - 1.0
    depthOfField: number; // 0.0 - 1.0
};

export type GlobalVisualStyle = {
    fontPair: FontPair;
    palette: ColorPalette;
    overlayOpacity: number;
    gridStyle: GridStyle;
    borderStyle: BorderStyle;
};

export type LayoutStyle =
    | "editorial_split"
    | "full_bleed"
    | "architectural_grid"
    | "minimal_caption"
    | "magazine"
    | "document_overlay"
    | "cinematic_property"
    | "modern_cards"
    | "right_rail"
    | "topographic"
    | "blueprint"
    | "luxury_frame"
    | "split_diagonal"
    | "asymmetric_split"
    | "cinematic_letterbox"
    | "overlay_card";

export type TransitionType =
    | "page_wipe"
    | "focus_pull"
    | "vertical_push"
    | "diagonal_wipe"
    | "document_slide"
    | "color_dip"
    | "masked_reveal"
    | "grid_wipe"
    | "cross_focus"
    | "shutter"
    | "card_stack"
    | "light_sweep"
    | "zoom_blur"
    | "morph_circle"
    | "slide_reveal"
    | "burn_transition";

export type SubtitleAnimation =
    | "word_reveal"
    | "character_stagger"
    | "fade_up"
    | "typewriter"
    | "slide_in_left"
    | "slide_in_right"
    | "scale_in"
    | "blur_in"
    | "rotate_in"
    | "clip_reveal"
    | "wave_stagger"
    | "elastic_spring";

export type CompositionStyle =
    | "hero_centered"
    | "asymmetric_balance"
    | "rule_of_thirds"
    | "golden_ratio"
    | "frame_within_frame"
    | "leading_lines"
    | "symmetry"
    | "diagonal_flow"
    | "layered_depth"
    | "negative_space";

export type GridStyle =
    | "none"
    | "architectural"
    | "blueprint"
    | "editorial"
    | "topographic"
    | "diagonal"
    | "dot_grid"
    | "line_grid";

export type BorderStyle =
    | "none"
    | "solid_thin"
    | "solid_thick"
    | "double_line"
    | "shadow_offset"
    | "double_shadow"
    | "inner_glow"
    | "film_frame";

export type FontPair = {
    heading: string;
    body: string;
    headingWeight: number;
    bodyWeight: number;
};

export type ColorPalette = {
    paper: string;
    ink: string;
    accent: string;
    secondary: string;
    overlay: string;
};

export type TransitionProfile = {
    duration: number;
    ease: string;
    direction: "left" | "right" | "up" | "down" | "random";
};

export type TypographySystem = {
    headingSize: number;
    bodySize: number;
    letterSpacing: number;
    lineHeight: number;
    textTransform: "uppercase" | "capitalize" | "none";
    textAlign: "left" | "center" | "right";
    highlightColor: string;
    useSplitType: boolean;
};

export type MotionSystem = {
    entranceType: EntranceType;
    entranceDuration: number;
    entranceStagger: number;
    entranceEase: string;
    cameraIntensity: number;
    useParallax: boolean;
    useKenBurns: boolean;
};

export type EntranceType =
    | "fade_up"
    | "scale_in"
    | "slide_from_left"
    | "slide_from_right"
    | "reveal_clip"
    | "blur_in"
    | "rotate_spring"
    | "stagger_cascade"
    | "elastic_bounce"
    | "perspective_flip";

export type ColorGrade = {
    saturation: number;
    contrast: number;
    brightness: number;
    warmth: number;
    shadows: string;
    midtones: string;
    highlights: string;
    vignette: number;
    grain: number;
};

export type IntroOutroStyle = {
    introType: "logo_reveal" | "fade_in_title" | "animated_slide" | "countdown" | "brand_sting";
    outroType: "cta_card" | "logo_end" | "fade_out" | "contact_info" | "brand_reveal";
    introDuration: number;
    outroDuration: number;
};

// ─── Design Assets ────────────────────────────────────────────────────

const LAYOUTS: LayoutStyle[] = [
    "editorial_split",
    "full_bleed",
    "architectural_grid",
    "minimal_caption",
    "magazine",
    "document_overlay",
    "cinematic_property",
    "modern_cards",
    "right_rail",
    "topographic",
    "blueprint",
    "luxury_frame",
    "split_diagonal",
    "asymmetric_split",
    "cinematic_letterbox",
    "overlay_card",
];

const TRANSITIONS: TransitionType[] = [
    "page_wipe",
    "focus_pull",
    "vertical_push",
    "diagonal_wipe",
    "document_slide",
    "color_dip",
    "masked_reveal",
    "grid_wipe",
    "cross_focus",
    "shutter",
    "card_stack",
    "light_sweep",
    "zoom_blur",
    "morph_circle",
    "slide_reveal",
    "burn_transition",
];

const SUBTITLE_ANIMATIONS: SubtitleAnimation[] = [
    "word_reveal",
    "character_stagger",
    "fade_up",
    "typewriter",
    "slide_in_left",
    "slide_in_right",
    "scale_in",
    "blur_in",
    "rotate_in",
    "clip_reveal",
    "wave_stagger",
    "elastic_spring",
];

const COMPOSITIONS: CompositionStyle[] = [
    "hero_centered",
    "asymmetric_balance",
    "rule_of_thirds",
    "golden_ratio",
    "frame_within_frame",
    "leading_lines",
    "symmetry",
    "diagonal_flow",
    "layered_depth",
    "negative_space",
];

const GRID_STYLES: GridStyle[] = [
    "none",
    "architectural",
    "blueprint",
    "editorial",
    "topographic",
    "diagonal",
    "dot_grid",
    "line_grid",
];

const BORDER_STYLES: BorderStyle[] = [
    "none",
    "solid_thin",
    "solid_thick",
    "double_line",
    "shadow_offset",
    "double_shadow",
    "inner_glow",
    "film_frame",
];

const ENTRANCE_TYPES: EntranceType[] = [
    "fade_up",
    "scale_in",
    "slide_from_left",
    "slide_from_right",
    "reveal_clip",
    "blur_in",
    "rotate_spring",
    "stagger_cascade",
    "elastic_bounce",
    "perspective_flip",
];

const FONT_PAIRS: FontPair[] = [
    { heading: "Archivo Black", body: "IBM Plex Mono", headingWeight: 900, bodyWeight: 400 },
    { heading: "Libre Franklin", body: "Archivo Black", headingWeight: 900, bodyWeight: 400 },
    { heading: "Montserrat", body: "IBM Plex Sans", headingWeight: 900, bodyWeight: 300 },
    { heading: "Urbanist", body: "IBM Plex Mono", headingWeight: 900, bodyWeight: 400 },
    { heading: "Manrope", body: "IBM Plex Mono", headingWeight: 800, bodyWeight: 400 },
    { heading: "Space Grotesk", body: "Libre Franklin", headingWeight: 700, bodyWeight: 300 },
    { heading: "Plus Jakarta Sans", body: "IBM Plex Mono", headingWeight: 800, bodyWeight: 400 },
    { heading: "DM Sans", body: "Archivo Black", headingWeight: 900, bodyWeight: 400 },
    { heading: "Sora", body: "IBM Plex Mono", headingWeight: 800, bodyWeight: 400 },
    { heading: "Outfit", body: "Libre Franklin", headingWeight: 900, bodyWeight: 300 },
    { heading: "Clash Display", body: "DM Sans", headingWeight: 800, bodyWeight: 400 },
    { heading: "General Sans", body: "Inter", headingWeight: 800, bodyWeight: 400 },
    { heading: "Poppins", body: "Geist", headingWeight: 900, bodyWeight: 300 },
    { heading: "League Spartan", body: "Inter", headingWeight: 900, bodyWeight: 400 },
];

const COLOR_PALETTES: ColorPalette[] = [
    { paper: "#F5EFE3", ink: "#101B2D", accent: "#B87333", secondary: "#F8F2E8", overlay: "#101B2DCC" },
    { paper: "#E7E0D2", ink: "#17352B", accent: "#A97142", secondary: "#F7F3EA", overlay: "#17352BCC" },
    { paper: "#F4EBDD", ink: "#242424", accent: "#D99B2B", secondary: "#FFF9EF", overlay: "#242424CC" },
    { paper: "#F7F0E8", ink: "#541F2B", accent: "#2C2A2B", secondary: "#FFF9F4", overlay: "#541F2BCC" },
    { paper: "#F3EBDD", ink: "#334A62", accent: "#C47A44", secondary: "#FFFFFF", overlay: "#334A62CC" },
    { paper: "#DED8CA", ink: "#123B3A", accent: "#C7A86B", secondary: "#FFFDF5", overlay: "#123B3ACC" },
    { paper: "#D8D1C2", ink: "#4D5539", accent: "#A88452", secondary: "#FFFCF4", overlay: "#4D5539CC" },
    { paper: "#E7DDCB", ink: "#1E2022", accent: "#C9A227", secondary: "#FFF9EC", overlay: "#1E2022CC" },
    { paper: "#E8E0CF", ink: "#162A46", accent: "#C58A55", secondary: "#FFFDF7", overlay: "#162A46CC" },
    { paper: "#F2E4D0", ink: "#6D3028", accent: "#B86E3F", secondary: "#FFF8ED", overlay: "#6D3028CC" },
    { paper: "#E9DFC8", ink: "#182126", accent: "#8E6F45", secondary: "#FFF9E9", overlay: "#182126CC" },
    { paper: "#E8E0D6", ink: "#43313F", accent: "#AD765A", secondary: "#FFF9F3", overlay: "#43313FCC" },
    { paper: "#EEE8DA", ink: "#344334", accent: "#B28B57", secondary: "#FFFCF3", overlay: "#344334CC" },
    { paper: "#F0E9DF", ink: "#17243B", accent: "#D8755B", secondary: "#FFFFFF", overlay: "#17243BCC" },
    { paper: "#E2D3BD", ink: "#332821", accent: "#C08A53", secondary: "#FFF8EB", overlay: "#332821CC" },
    { paper: "#DDE2D4", ink: "#374345", accent: "#91A477", secondary: "#FCFFF7", overlay: "#374345CC" },
];

const CAMERA_MOVEMENTS: CameraMovement[] = [
    "push_in",
    "push_out",
    "pan_left",
    "pan_right",
    "parallax",
    "tilt",
    "dolly",
    "orbit",
    "rack_focus",
    "light_sweep",
    "dolly_zoom",
    "dutch_angle",
    "aerial_reveal",
    "vertical_track",
    "arc_rotate",
    "ken_burns_slow",
];

// ─── Seeded Random ────────────────────────────────────────────────────

function seededHash(seed: string, salt: string): number {
    const hash = createHash("sha256")
        .update(`${seed}:${salt}`)
        .digest("hex");
    return Number.parseInt(hash.slice(0, 12), 16);
}

function seededInt(seed: string, salt: string, min: number, max: number): number {
    const value = seededHash(seed, salt);
    return min + (value % (max - min + 1));
}

function seededFloat(seed: string, salt: string, min: number, max: number): number {
    const value = seededHash(seed, salt);
    return min + (value / 0xFFFFFFFF) * (max - min);
}

function seededChoice<T>(seed: string, salt: string, choices: readonly T[]): T {
    const index = seededInt(seed, salt, 0, choices.length - 1);
    return choices[index]!;
}

function seededShuffle<T>(seed: string, salt: string, items: readonly T[]): T[] {
    const result = [...items];
    const hash = seededHash(seed, salt);
    for (let i = result.length - 1; i > 0; i--) {
        const j = (hash + i * 31) % (i + 1);
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
}

// ─── History tracking for non-repetition ──────────────────────────────

const usageHistory = new Map<string, Set<string>>();

function markUsed(fingerprint: string, category: string, value: string): void {
    const key = `${fingerprint}:${category}`;
    if (!usageHistory.has(key)) usageHistory.set(key, new Set());
    usageHistory.get(key)!.add(value);
}

function isUsed(fingerprint: string, category: string, value: string): boolean {
    const key = `${fingerprint}:${category}`;
    const set = usageHistory.get(key);
    return set ? set.has(value) : false;
}

function cleanHistory(fingerprint: string): void {
    for (const key of usageHistory.keys()) {
        if (key.startsWith(`${fingerprint}:`)) {
            usageHistory.delete(key);
        }
    }
}

// ─── Main Generation ──────────────────────────────────────────────────

export function generateVisualIdentity(
    variationSeed: string,
    sceneCount: number,
    previousFingerprints: string[] = []
): VisualIdentity {
    const seed = variationSeed;
    const fingerprint = createHash("sha256")
        .update(`${seed}:${sceneCount}:${previousFingerprints.join(",")}`)
        .digest("hex")
        .slice(0, 16);

    // Clear history for this generation
    cleanHistory(fingerprint);

    // Generate global style
    const globalStyle = generateGlobalStyle(seed, fingerprint);

    // Generate scene variations
    const sceneVariations: SceneVariation[] = [];
    for (let i = 0; i < sceneCount; i++) {
        const sceneSalt = `scene-${i}`;
        const sceneVariation = generateSceneVariation(seed, sceneSalt, i, fingerprint);
        sceneVariations.push(sceneVariation);
    }

    // Generate transitions
    const transitionCount = Math.max(1, sceneCount - 1);
    const transitions: TransitionProfile[] = [];
    for (let i = 0; i < transitionCount; i++) {
        const tSalt = `transition-${i}`;
        const direction = seededChoice(seed, `${tSalt}-dir`, ["left", "right", "up", "down", "random"] as const);
        transitions.push({
            duration: seededFloat(seed, `${tSalt}-dur`, 0.15, 0.42),
            ease: seededChoice(seed, `${tSalt}-ease`, [
                "power2.inOut",
                "power3.inOut",
                "power4.inOut",
                "expo.inOut",
                "back.inOut(1.4)",
            ]),
            direction,
        });
    }

    // Generate typography system
    const typography: TypographySystem = {
        headingSize: seededInt(seed, "h-size", 64, 104),
        bodySize: seededInt(seed, "b-size", 22, 38),
        letterSpacing: seededFloat(seed, "l-space", -0.05, 0.08),
        lineHeight: seededFloat(seed, "l-height", 0.88, 1.15),
        textTransform: seededChoice(seed, "t-case", ["uppercase", "capitalize", "none"]),
        textAlign: seededChoice(seed, "t-align", ["left", "center", "right"]),
        highlightColor: globalStyle.palette.accent,
        useSplitType: seededInt(seed, "split", 0, 1) === 1,
    };

    // Generate motion system
    const motionSystem: MotionSystem = {
        entranceType: seededChoice(seed, "entrance", ENTRANCE_TYPES),
        entranceDuration: seededFloat(seed, "e-dur", 0.35, 0.85),
        entranceStagger: seededFloat(seed, "e-stagger", 0.035, 0.095),
        entranceEase: seededChoice(seed, "e-ease", [
            "power3.out",
            "expo.out",
            "back.out(1.3)",
            "elastic.out(1,0.4)",
            "bounce.out",
        ]),
        cameraIntensity: seededFloat(seed, "c-int", 0.3, 1.0),
        useParallax: seededInt(seed, "parallax", 0, 1) === 1,
        useKenBurns: seededInt(seed, "kenburns", 0, 1) === 1,
    };

    // Generate color grade
    const gradeSeed = seededHash(seed, "grade");
    const colorGrade: ColorGrade = {
        saturation: seededFloat(seed, "sat", 0.78, 1.12),
        contrast: seededFloat(seed, "con", 0.92, 1.15),
        brightness: seededFloat(seed, "bri", -0.035, 0.035),
        warmth: seededFloat(seed, "warm", -0.05, 0.08),
        shadows: seededChoice(seed, "shadows", ["#101B2D", "#17352B", "#242424", "#334A62", "#1E2022"]),
        midtones: seededChoice(seed, "midtones", ["#F5EFE3", "#F4EBDD", "#F3EBDD", "#E7DDCB", "#E8E0CF"]),
        highlights: seededChoice(seed, "highlights", ["#FFF9EF", "#FFFFFF", "#FFFDF7", "#FFF9EC", "#FFF8ED"]),
        vignette: seededFloat(seed, "vignette", 0.0, 0.35),
        grain: seededFloat(seed, "grain", 0.0, 0.08),
    };

    // Generate intro/outro
    const introOutro: IntroOutroStyle = {
        introType: seededChoice(seed, "intro", ["logo_reveal", "fade_in_title", "animated_slide", "countdown", "brand_sting"]),
        outroType: seededChoice(seed, "outro", ["cta_card", "logo_end", "fade_out", "contact_info", "brand_reveal"]),
        introDuration: seededFloat(seed, "intro-dur", 0.8, 2.5),
        outroDuration: seededFloat(seed, "outro-dur", 1.0, 3.0),
    };

    return {
        fingerprint,
        sceneVariations,
        globalStyle,
        transitions,
        typography,
        motionSystem,
        colorGrade,
        introOutro,
    };
}

function generateGlobalStyle(seed: string, fingerprint: string): GlobalVisualStyle {
    // Font pair - avoid the previous generation's choice if possible
    const fontIndex = seededInt(seed, "font", 0, FONT_PAIRS.length - 1);
    const fontPair = FONT_PAIRS[fontIndex]!;

    // Color palette - avoid the previous generation's choice if possible
    const paletteIndex = seededInt(seed, "palette", 0, COLOR_PALETTES.length - 1);
    const palette = COLOR_PALETTES[paletteIndex]!;

    return {
        fontPair,
        palette,
        overlayOpacity: seededFloat(seed, "overlay", 0.45, 0.95),
        gridStyle: seededChoice(seed, "grid", GRID_STYLES),
        borderStyle: seededChoice(seed, "border", BORDER_STYLES),
    };
}

function generateSceneVariation(
    seed: string,
    salt: string,
    sceneIndex: number,
    fingerprint: string
): SceneVariation {
    // Pick layout, ensuring variation across scenes
    const layoutIndex = seededInt(seed, `${salt}-layout`, 0, LAYOUTS.length - 1);
    const layout = LAYOUTS[layoutIndex]!;

    // Pick camera movement
    const camIndex = seededInt(seed, `${salt}-cam`, 0, CAMERA_MOVEMENTS.length - 1);
    const cameraMovement = CAMERA_MOVEMENTS[camIndex]!;

    // Pick transitions
    const tInIndex = seededInt(seed, `${salt}-tin`, 0, TRANSITIONS.length - 1);
    const tOutIndex = seededInt(seed, `${salt}-tout`, 0, TRANSITIONS.length - 1);

    // Ensure in/out are different
    const transIn = TRANSITIONS[tInIndex]!;
    let transOut = TRANSITIONS[tOutIndex]!;
    if (transOut === transIn) {
        transOut = TRANSITIONS[(tOutIndex + 1 + sceneIndex) % TRANSITIONS.length]!;
    }

    return {
        sceneIndex,
        layout,
        cameraMovement,
        transitionIn: transIn,
        transitionOut: transOut,
        subtitleAnimation: seededChoice(seed, `${salt}-sub`, SUBTITLE_ANIMATIONS),
        compositionStyle: seededChoice(seed, `${salt}-comp`, COMPOSITIONS),
        motionIntensity: seededFloat(seed, `${salt}-motion`, 0.3, 1.0),
        depthOfField: seededFloat(seed, `${salt}-dof`, 0.0, 1.0),
    };
}

/**
 * Generates a CSS class name string for a given scene variation.
 */
export function variationCssClasses(variation: SceneVariation, global: GlobalVisualStyle): string[] {
    return [
        `layout-${variation.layout}`,
        `cam-${variation.cameraMovement}`,
        `trans-in-${variation.transitionIn}`,
        `trans-out-${variation.transitionOut}`,
        `sub-${variation.subtitleAnimation}`,
        `comp-${variation.compositionStyle}`,
        `grid-${global.gridStyle}`,
        `border-${global.borderStyle}`,
        `motion-${Math.round(variation.motionIntensity * 10)}`,
    ];
}

/**
 * Converts a camera movement to ffmpeg zoompan parameters.
 */
export function cameraMovementToFfmpeg(
    movement: CameraMovement,
    duration: number
): {
    zoom: string;
    x: string;
    y: string;
} {
    const d = Math.max(2, duration);
    const fps = 30;
    const totalFrames = Math.round(d * fps);

    switch (movement) {
        case "push_in":
            return {
                zoom: `min(zoom+0.00065,1.12)`,
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "push_out":
            return {
                zoom: `if(eq(on,0),1.12,max(1.015,zoom-0.0006))`,
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "pan_left":
            return {
                zoom: "1.08",
                x: `min(iw-iw/zoom,on*${(0.6 * totalFrames) / fps})`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "pan_right":
            return {
                zoom: "1.08",
                x: `max(0,iw-iw/zoom-on*${(0.6 * totalFrames) / fps})`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "parallax":
            return {
                zoom: "1.1",
                x: `iw/2-(iw/zoom/2)+sin(on*${(Math.PI * 2) / (fps * 4)})*${totalFrames * 0.15}`,
                y: `ih/2-(ih/zoom/2)+cos(on*${(Math.PI * 2) / (fps * 4)})*${totalFrames * 0.1}`,
            };
        case "tilt":
            return {
                zoom: "1.06",
                x: `iw/2-(iw/zoom/2)`,
                y: `min(ih-ih/zoom,on*${(0.4 * totalFrames) / fps})`,
            };
        case "dolly":
            return {
                zoom: `min(zoom+0.00045,1.08)`,
                x: `iw/2-(iw/zoom/2)+sin(on*${(Math.PI * 2) / (fps * 3)})*${totalFrames * 0.08}`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "orbit":
            return {
                zoom: "1.07",
                x: `iw/2-(iw/zoom/2)+${totalFrames * 0.3}*sin(on*${(Math.PI * 2) / (fps * 5)})`,
                y: `ih/2-(ih/zoom/2)+${totalFrames * 0.2}*cos(on*${(Math.PI * 2) / (fps * 5)})`,
            };
        case "rack_focus":
            return {
                zoom: "1.0",
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "light_sweep":
            return {
                zoom: "1.03",
                x: `iw/2-(iw/zoom/2)+${totalFrames * 0.5}*sin(on/${fps})`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "dolly_zoom":
            return {
                zoom: `if(eq(on,0),1.12,max(1.0,zoom-0.0008))`,
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "dutch_angle":
            return {
                zoom: "1.05",
                x: `iw/2-(iw/zoom/2)+sin(on*${(Math.PI * 2) / (fps * 4)})*${totalFrames * 0.12}`,
                y: `ih/2-(ih/zoom/2)`,
            };
        case "aerial_reveal":
            return {
                zoom: "1.15",
                x: `iw/2-(iw/zoom/2)`,
                y: `max(0,ih-ih/zoom-on*${(0.6 * totalFrames) / fps})`,
            };
        case "vertical_track":
            return {
                zoom: "1.06",
                x: `iw/2-(iw/zoom/2)`,
                y: `min(ih-ih/zoom,on*${(0.5 * totalFrames) / fps})`,
            };
        case "arc_rotate":
            return {
                zoom: "1.06",
                x: `iw/2-(iw/zoom/2)+${totalFrames * 0.25}*sin(on*${(Math.PI * 2) / (fps * 6)})`,
                y: `ih/2-(ih/zoom/2)+${totalFrames * 0.25}*cos(on*${(Math.PI * 2) / (fps * 6)})`,
            };
        case "ken_burns_slow":
            return {
                zoom: `min(zoom+0.00035,1.06)`,
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)+sin(on*${(Math.PI * 2) / (fps * 8)})*${totalFrames * 0.06}`,
            };
        default:
            return {
                zoom: "1.03",
                x: `iw/2-(iw/zoom/2)`,
                y: `ih/2-(ih/zoom/2)`,
            };
    }
}

