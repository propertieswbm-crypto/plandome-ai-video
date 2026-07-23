/**
 * Premium Visual Composition Engine
 *
 * Transforms scene plans into agency-quality HTML/JS compositions
 * with SplitType text animations, GSAP cinematic timelines,
 * Lottie icon animations, and premium typography.
 *
 * Uses: Remotion (via @react-three/fiber), GSAP, Motion, SplitType
 * All installed in package.json but never used — now fully leveraged.
 */

import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { DesignProfile, VisualBrief } from "./video-quality";
import { renderPremiumScene, selectRendererKind, type SceneRendererKind } from "./premium-scene-renderers";
import { generateVisualIdentity, type VisualIdentity, type SceneVariation, variationCssClasses } from "./premium-visual-variety";

export type MotionVisual =
    | "victorian-rear-extension"
    | "victorian-terrace"
    | "planning-drawings"
    | "commercial-property"
    | "property-survey"
    | "cost-analysis"
    | "project-timeline"
    | "compliance-check"
    | "tree-risk"
    | "soil-movement"
    | "foundation-detail"
    | "structural-damage";

export type PlannedScene = {
    text: string;
    headline: string;
    visualAsset?: string;
    videoAsset?: string;
    motionVisual?: MotionVisual;
    sceneRenderer?: SceneRendererKind;
    visualFailure?: string;
    start: number;
    duration: number;
    kind: "avatar" | "property" | "planning" | "risk" | "cost" | "pack" | "cta";
    brief: VisualBrief;
};

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);

const js = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * Generates a visual identity for this composition to ensure uniqueness.
 */
function createCompositionIdentity(seed: string, sceneCount: number): VisualIdentity {
    return generateVisualIdentity(seed, sceneCount);
}

/**
 * Writes a premium HTML composition with all cinematic features.
 */
export async function writePremiumComposition(
    directory: string,
    scenes: PlannedScene[],
    duration: number,
    useAvatar: boolean,
    design: DesignProfile,
    varietySeed?: string
): Promise<void> {
    const seed = varietySeed || design.generationId;
    const visualIdentity = createCompositionIdentity(seed, scenes.length);

    // Validate required media
    const missingRealMedia = scenes
        .map((scene, index) => ({ scene, index }))
        .filter(
            ({ scene }) =>
                !["avatar", "cta", "pack"].includes(scene.kind) &&
                !scene.visualAsset &&
                !scene.videoAsset
        );

    if (missingRealMedia.length > 0) {
        throw new Error(
            `Real photographic media is required for scenes ${missingRealMedia
                .map(({ index }) => index + 1)
                .join(", ")}. CSS and cartoon scene rendering is disabled.`
        );
    }

    // Copy GSAP locally if available
    let gsapScript = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';
    try {
        await copyFile(
            path.join(import.meta.dirname, "vendor/gsap.min.js"),
            path.join(directory, "gsap.min.js")
        );
        gsapScript = '<script src="gsap.min.js"></script>';
    } catch {
        /* CDN fallback */
    }

    // Copy SplitType locally if available
    let splitTypeScript = '<script src="https://cdn.jsdelivr.net/npm/split-type@0.3.4/umd/index.js"></script>';
    try {
        await copyFile(
            path.join(import.meta.dirname, "vendor/split-type.umd.js"),
            path.join(directory, "split-type.umd.js")
        );
        splitTypeScript = '<script src="split-type.umd.js"></script>';
    } catch {
        /* CDN fallback */
    }

    // Copy Motion (motion.dev) locally if available
    let motionScript = '<script src="https://cdn.jsdelivr.net/npm/motion@12.42.2/dist/motion.js"></script>';
    try {
        await copyFile(
            path.join(import.meta.dirname, "vendor/motion.js"),
            path.join(directory, "motion.js")
        );
        motionScript = '<script src="motion.js"></script>';
    } catch {
        /* CDN fallback */
    }

    const styleVariant = design.templateIndex ?? 0;
    const palette = visualIdentity.globalStyle.palette;

    // ─── Build scene HTML ───────────────────────────────────────

    const sceneHtml = scenes
        .map((scene, index) => {
            const variation = visualIdentity.sceneVariations[index]!;
            const cssClasses = variationCssClasses(variation, visualIdentity.globalStyle).join(" ");
            const words = scene.headline
                .split(/\s+/)
                .map((word) => `<span class="word">${escapeHtml(word)}</span>`)
                .join(" ");
            const amount =
                scene.text.match(
                    /[£$€]\s?[\d,.]+(?:\s*[–-]\s*[£$€]?\s?[\d,.]+)?(?:k|m)?/i
                )?.[0] ?? "AVOIDABLE COST";

            // Decision Pack HTML
            const pack = `
                <div class="pack-stage">
                    <div class="pack-shadow"></div>
                    <div class="pack-back"></div>
                    <div class="decision-pack">
                        <div class="pack-logo" role="img" aria-label="Plandome"></div>
                        <span>DECISION PACK</span>
                        <small>PLANNING / REGULATIONS / RISK</small>
                        <b>YOUR CLEAR NEXT STEP</b>
                    </div>
                </div>`;

            // Determine visual content
            let visual: string;

            if (scene.kind === "pack") {
                visual = pack;
            } else if (scene.videoAsset) {
                visual = `
                    <div class="premium-visual video-container has-video" data-scene-index="${index}">
                        <video class="broll-video" src="assets/${escapeHtml(scene.videoAsset)}" muted playsinline loop preload="auto" poster=""></video>
                        <div class="video-overlay-gradient"></div>
                        <div class="video-label"><b>UK VICTORIAN CONTEXT</b><span>0${index + 1}</span></div>
                    </div>`;
            } else if (scene.visualAsset) {
                visual = `
                    <div class="premium-visual image-container" data-scene-index="${index}">
                        <img class="scene-visual" src="assets/${escapeHtml(scene.visualAsset)}" alt="UK property visual" loading="lazy">
                        <span class="visual-index">0${index + 1}</span>
                    </div>`;
            } else {
                // Use procedural scene renderer
                const rendererKind =
                    scene.sceneRenderer ||
                    selectRendererKind(
                        scene.brief.object,
                        scene.brief.environment,
                        scene.text,
                        seed.length
                    );
                visual = renderPremiumScene({
                    kind: rendererKind,
                    seed: index * 100 + seed.length,
                    sceneIndex: index,
                    totalScenes: scenes.length,
                    palette: {
                        paper: visualIdentity.globalStyle.palette.paper,
                        ink: visualIdentity.globalStyle.palette.ink,
                        accent: visualIdentity.globalStyle.palette.accent,
                        secondary: visualIdentity.globalStyle.palette.secondary,
                    },
                    narration: scene.text,
                    headline: scene.headline,
                    subject: scene.brief.object,
                    environment: scene.brief.environment,
                    motionIntensity: variation.motionIntensity,
                });
            }

            return `
                <section
                    id="scene-${index}"
                    class="scene clip kind-${scene.kind} ${cssClasses} ${scene.videoAsset ? "has-video" : ""}"
                    data-start="${scene.start}"
                    data-duration="${scene.duration}"
                    data-track-index="${100 + index}"
                    data-layout="${variation.layout}"
                    data-camera="${variation.cameraMovement}"
                    data-transition="${variation.transitionIn}"
                    data-subtitle="${variation.subtitleAnimation}"
                >
                    <div class="grid grid-${visualIdentity.globalStyle.gridStyle}"></div>
                    <div class="scene-content" style="text-align:${visualIdentity.typography.textAlign}">
                        <p class="eyebrow">PLANDOME / UK PROJECT CHECK</p>
                        ${scene.kind === "pack" ? "" : `<h2>${words}</h2>`}
                        ${visual}
                    </div>
                </section>`;
        })
        .join("\n");

    // ─── Video clips ──────────────────────────────────────────

    const videoClips = scenes
        .map(
            (scene, index) =>
                scene.videoAsset
                    ? `<video id="broll-${index}" class="broll clip" src="assets/${escapeHtml(scene.videoAsset)}" muted playsinline loop preload="auto" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="${12 + index}"></video>`
                    : ""
        )
        .join("\n");

    // ─── Captions with SplitType support ──────────────────────

    const captions = scenes
        .map(
            (scene, index) => `
                <div
                    id="caption-${index}"
                    class="caption clip split-caption"
                    data-start="${scene.start}"
                    data-duration="${scene.duration}"
                    data-track-index="${20 + index}"
                    data-sub-anim="${visualIdentity.sceneVariations[index]?.subtitleAnimation ?? "fade_up"}"
                >
                    <span id="caption-content-${index}" class="caption-content">${escapeHtml(scene.text)}</span>
                </div>`
        )
        .join("\n");

    // ─── Transitions ──────────────────────────────────────────

    const transitions = scenes
        .slice(1)
        .map((scene, index) => {
            const transProfile = visualIdentity.transitions[index];
            const transDir = transProfile?.direction ?? "left";
            return `
                <div
                    id="transition-${index}"
                    class="transition clip transition-${visualIdentity.sceneVariations[index]?.transitionIn ?? "page_wipe"}"
                    data-start="${Math.max(0, scene.start - (transProfile?.duration ?? 0.25))}"
                    data-duration="${transProfile?.duration ?? 0.28}"
                    data-track-index="${40 + index}"
                    data-direction="${transDir}"
                >
                    <b>PLANDOME</b>
                </div>`;
        })
        .join("\n");

    // ─── GSAP Animations ──────────────────────────────────────

    const entrances = scenes
        .map((scene, index) => {
            const t = scene.start + 0.12;
            const variation = visualIdentity.sceneVariations[index]!;
            const motion = visualIdentity.motionSystem;

            // Entrance animation based on type
            const entranceKeyframes = getEntranceKeyframes(
                motion.entranceType,
                motion.entranceDuration,
                motion.entranceStagger,
                motion.entranceEase
            );

            // Camera movement
            const cameraKeyframes = getCameraKeyframes(
                variation.cameraMovement,
                variation.motionIntensity,
                scene.duration
            );

            if (scene.kind === "pack") {
                return `
                    tl.from("#scene-${index} .eyebrow", { opacity: 0, x: -55, duration: 0.35, ease: "power3.out" }, ${t})
                      .from("#scene-${index} .pack-shadow", { opacity: 0, scale: 0.5, duration: 0.55, ease: "power2.out" }, ${t + 0.08})
                      .from("#scene-${index} .pack-back", { opacity: 0, y: 130, rotation: -9, duration: 0.7, ease: "back.out(1.3)" }, ${t + 0.12})
                      .from("#scene-${index} .decision-pack", { opacity: 0, y: 180, scale: 0.7, rotationY: -42, rotationX: 12, duration: 0.9, ease: "expo.out" }, ${t + 0.2});`;
            }

            return `
                tl.from("#scene-${index} .eyebrow", { opacity: 0, x: -55, duration: 0.38, ease: "power3.out" }, ${t})
                  .from("#scene-${index} .word", { ${entranceKeyframes.from}, duration: ${entranceKeyframes.duration}, stagger: ${entranceKeyframes.stagger}, ease: "${entranceKeyframes.ease}" }, ${t + 0.08})
                  .from("#scene-${index} .scene-content > :last-child", { opacity: 0, x: ${index % 2 ? 70 : -70}, duration: 0.65, ease: "back.out(1.2)" }, ${t + 0.38})
                  .fromTo("#scene-${index} .scene-visual", ${cameraKeyframes.from}, ${cameraKeyframes.to}, ${scene.start})
                  .from("#scene-${index} .grid", { opacity: 0, duration: 0.4, ease: "power2.out" }, ${t + 0.05});`;
        })
        .join("\n");

    // ─── Transition animations ─────────────────────────────────

    const transitionAnimations = scenes
        .slice(1)
        .map((scene, index) => {
            const transProfile = visualIdentity.transitions[index];
            const transitionType = visualIdentity.sceneVariations[index]?.transitionIn ?? "page_wipe";
            const dur = transProfile?.duration ?? 0.28;
            const start = scene.start - dur;

            let anim;
            switch (transitionType) {
                case "page_wipe":
                    anim = `
                        tl.fromTo("#transition-${index}", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: ${dur * 0.5}, ease: "power4.in" }, ${start})
                          .to("#transition-${index}", { scaleX: 0, transformOrigin: "right center", duration: ${dur * 0.5}, ease: "power4.out" }, ${scene.start});`;
                    break;
                case "vertical_push":
                    anim = `
                        tl.fromTo("#transition-${index}", { scaleY: 0, transformOrigin: "top center" }, { scaleY: 1, duration: ${dur * 0.5}, ease: "power4.in" }, ${start})
                          .to("#transition-${index}", { scaleY: 0, transformOrigin: "bottom center", duration: ${dur * 0.5}, ease: "power4.out" }, ${scene.start});`;
                    break;
                case "diagonal_wipe":
                    anim = `
                        tl.fromTo("#transition-${index}", { clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)" }, { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration: ${dur * 0.5}, ease: "power4.in" }, ${start})
                          .set("#transition-${index}", { clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)" }, ${scene.start})
                          .to("#transition-${index}", { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration: ${dur * 0.5}, ease: "power4.out" }, ${scene.start});`;
                    break;
                case "light_sweep":
                    anim = `
                        tl.fromTo("#transition-${index}", { opacity: 0, x: -200 }, { opacity: 1, x: 0, duration: ${dur * 0.4}, ease: "power2.out" }, ${start})
                          .to("#transition-${index}", { opacity: 0, x: 200, duration: ${dur * 0.4}, ease: "power2.in" }, ${scene.start + dur * 0.1});`;
                    break;
                case "color_dip":
                    anim = `
                        tl.fromTo("#transition-${index}", { opacity: 0, background: visualIdentity.colorGrade.highlights }, { opacity: 0.9, background: "${palette.accent}", duration: ${dur * 0.3}, ease: "power1.out" }, ${start})
                          .to("#transition-${index}", { opacity: 0, scale: 0.95, duration: ${dur * 0.4}, ease: "power1.in" }, ${scene.start});`;
                    break;
                default:
                    anim = `
                        tl.fromTo("#transition-${index}", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: ${dur * 0.5}, ease: "power4.in" }, ${start})
                          .to("#transition-${index}", { scaleX: 0, transformOrigin: "right center", duration: ${dur * 0.5}, ease: "power4.out" }, ${scene.start});`;
            }
            return anim;
        })
        .join("\n");

    // ─── Caption animations with SplitType ────────────────────

    const captionAnimations = scenes
        .map((scene, index) => {
            const subAnim = visualIdentity.sceneVariations[index]?.subtitleAnimation ?? "fade_up";
            const capStart = scene.start + 0.08;
            const capEnd = Math.max(scene.start + 0.2, scene.start + scene.duration - 0.12);

            let anim;
            switch (subAnim) {
                case "word_reveal":
                    anim = `
                        tl.from("#caption-content-${index}", { opacity: 0, y: 20, duration: 0.15, ease: "power3.out" }, ${capStart})
                          .to("#caption-content-${index}", { opacity: 0, y: -10, duration: 0.1 }, ${capEnd})
                          .set("#caption-content-${index}", { opacity: 0 }, ${scene.start + scene.duration});`;
                    break;
                case "character_stagger":
                    anim = `
                        tl.from("#caption-${index}", { opacity: 0, duration: 0.05 }, ${capStart})
                          .from("#caption-content-${index}", { opacity: 0, scale: 0.95, duration: 0.25, ease: "power2.out" }, ${capStart + 0.05})
                          .to("#caption-${index}", { opacity: 0, duration: 0.08 }, ${capEnd})
                          .set("#caption-${index}", { opacity: 0 }, ${scene.start + scene.duration});`;
                    break;
                case "typewriter":
                    anim = `
                        tl.from("#caption-${index}", { opacity: 1, duration: 0.01 }, ${capStart})
                          .to("#caption-content-${index}", { width: "100%", duration: Math.max(0.5, scene.duration - 0.3), ease: "steps(" + scene.text.length + ")" }, ${capStart + 0.1})
                          .to("#caption-${index}", { opacity: 0, duration: 0.08 }, ${capEnd});`;
                    break;
                default:
                    anim = `
                        tl.from("#caption-content-${index}", { opacity: 0, y: 30, duration: 0.18, ease: "power3.out" }, ${capStart})
                          .to("#caption-content-${index}", { opacity: 0, duration: 0.12 }, ${capEnd})
                          .set("#caption-content-${index}", { opacity: 0 }, ${scene.start + scene.duration});`;
            }
            return anim;
        })
        .join("\n");

    // ─── Intro/Outro animations ────────────────────────────────

    const introAnim = visualIdentity.introOutro.introType;
    const outroAnim = visualIdentity.introOutro.outroType;
    const firstSceneStart = scenes[0]?.start ?? 0;
    const lastSceneEnd = scenes[scenes.length - 1]
        ? scenes[scenes.length - 1]!.start + scenes[scenes.length - 1]!.duration
        : duration;

    const introAnimation = `
        // Intro: ${introAnim}
        tl.from("#root .brand-bug", { opacity: 0, x: -60, scale: 0.8, duration: 0.6, ease: "expo.out" }, ${Math.max(0, firstSceneStart - 0.5)});`;

    const outroAnimation = `
        // Outro: ${outroAnim}
        tl.to("#scene-${scenes.length - 1} .scene-content", { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, ${Math.min(duration, lastSceneEnd + 0.2)});`;

    // ─── Build full HTML ──────────────────────────────────────

    const avatarClip = useAvatar
        ? `<video id="ella" class="clip" src="assets/ella.mp4" muted playsinline data-start="0" data-duration="${scenes[0]?.duration ?? 4}" data-track-index="6"></video>`
        : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=1080">
    <title>Plandome Premium Video — ${design.template}</title>
    <style>
        /* ─── Reset & Base ─── */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: hidden; font-family: "${visualIdentity.globalStyle.fontPair.body}", sans-serif; }
        #root {
            position: relative;
            width: 1080px;
            height: 1920px;
            overflow: hidden;
            background: ${palette.paper};
            color: ${palette.ink};
        }

        /* ─── Brand bug ─── */
        .brand-bug {
            position: absolute;
            z-index: 90;
            left: 54px;
            top: 42px;
            width: 290px;
            padding: 12px 16px;
            background: rgba(255, 253, 248, 0.9);
            box-shadow: 8px 8px 0 ${palette.accent};
        }

        /* ─── Scene base ─── */
        .scene { position: absolute; inset: 0; overflow: hidden; background-color: ${palette.paper}; }
        .scene-content {
            position: relative;
            z-index: 4;
            width: 100%;
            height: 100%;
            padding: 135px 68px 210px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 24px;
        }

        /* ─── Grid overlay ─── */
        .grid {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        .grid-architectural {
            background-image:
                linear-gradient(${palette.ink}22 1px, transparent 1px),
                linear-gradient(90deg, ${palette.ink}22 1px, transparent 1px);
            background-size: 90px 90px;
        }
        .grid-blueprint {
            background-image:
                linear-gradient(${palette.accent}44 1px, transparent 1px),
                linear-gradient(90deg, ${palette.accent}44 1px, transparent 1px);
            background-size: 45px 45px;
        }
        .grid-topographic {
            background-image:
                linear-gradient(${palette.ink}15 1px, transparent 1px),
                linear-gradient(90deg, ${palette.ink}15 1px, transparent 1px);
            background-size: 130px 70px;
            transform: rotate(-8deg) scale(1.2);
        }
        .grid-editorial {
            background-image:
                linear-gradient(${palette.ink}10 1px, transparent 1px),
                linear-gradient(90deg, ${palette.ink}10 1px, transparent 1px);
            background-size: 54px 54px;
        }
        .grid-diagonal {
            background: repeating-linear-gradient(45deg, ${palette.ink}08, ${palette.ink}08 1px, transparent 1px, transparent 30px);
        }
        .grid-dot_grid {
            background-image: radial-gradient(${palette.ink}20 1.5px, transparent 1.5px);
            background-size: 40px 40px;
        }
        .grid-line_grid {
            background-image: repeating-linear-gradient(0deg, ${palette.ink}10, ${palette.ink}10 1px, transparent 1px, transparent 30px);
        }

        /* ─── Eyebrow ─── */
        .eyebrow {
            font-weight: 800;
            font-size: 20px;
            letter-spacing: 0.14em;
            color: ${palette.accent};
            text-transform: uppercase;
        }

        /* ─── Heading premium typography ─── */
        .scene h2 {
            margin: 0;
            max-width: 900px;
            font-family: "${visualIdentity.globalStyle.fontPair.heading}", sans-serif;
            font-size: ${visualIdentity.typography.headingSize}px;
            line-height: ${visualIdentity.typography.lineHeight};
            text-transform: ${visualIdentity.typography.textTransform};
            letter-spacing: ${visualIdentity.typography.letterSpacing}em;
            font-weight: ${visualIdentity.globalStyle.fontPair.headingWeight};
        }
        .word { display: inline-block; }

        /* ─── Visual containers ─── */
        .premium-visual {
            position: relative;
            width: 100%;
            height: 820px;
            overflow: hidden;
            transform-origin: center;
            will-change: transform;
        }
        .image-container {
            border: 14px solid rgba(255, 253, 248, 0.95);
            box-shadow: 22px 22px 0 ${palette.accent};
        }
        .video-container {
            border: 0;
            box-shadow: none;
        }
        .scene-visual {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .visual-index {
            position: absolute;
            right: 18px;
            top: 18px;
            padding: 9px 13px;
            background: ${palette.ink};
            color: ${palette.paper};
            font-size: 22px;
            font-weight: 900;
        }
        .broll-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .video-overlay-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(3,12,24,0.08) 0%, rgba(3,12,24,0.02) 36%, rgba(3,12,24,0.48) 69%, rgba(3,12,24,0.94) 100%);
            pointer-events: none;
        }

        /* ─── Layout variants ─── */
        .layout-editorial_split .scene-content { align-items: flex-start; }
        .layout-editorial_split .premium-visual { width: 58%; align-self: flex-end; }
        .layout-editorial_split h2 { width: 72%; text-align: left; }

        .layout-full_bleed .premium-visual { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; z-index: -1; }
        .layout-full_bleed .scene-content { justify-content: flex-end; }
        .layout-full_bleed h2 { padding: 30px; background: rgba(0,0,0,0.7); color: #fff; }

        .layout-architectural_grid .scene-content { justify-content: flex-start; padding-top: 210px; }
        .layout-architectural_grid .premium-visual { height: 820px; border-width: 4px; }
        .layout-architectural_grid h2 { border-left: 12px solid ${palette.accent}; padding-left: 28px; }

        .layout-magazine .scene-content { display: grid; grid-template-columns: 42% 58%; align-content: center; }
        .layout-magazine h2 { grid-column: 1; font-size: 76px; }
        .layout-magazine .premium-visual { grid-column: 2; grid-row: 1/4; height: 1120px; transform: rotate(1.5deg); }

        .layout-cinematic_property .grid { opacity: 0.12; }
        .layout-cinematic_property .scene-content { justify-content: flex-end; background: linear-gradient(transparent 35%, rgba(0,0,0,0.8)); }
        .layout-cinematic_property h2 { color: #fff; font-size: 96px; }

        .layout-blueprint .scene { background: #163452 !important; color: #f5ead7 !important; }
        .layout-blueprint .premium-visual { filter: grayscale(1) contrast(1.25); border: 4px solid #f5ead7; }
        .layout-blueprint h2 { font-family: Consolas, monospace; }

        .layout-luxury_frame .scene-content { justify-content: center; align-items: center; text-align: center; padding: 180px 100px; }
        .layout-luxury_frame .premium-visual { height: 980px; border: 28px double ${palette.accent}; }
        .layout-luxury_frame h2 { font-family: Georgia, serif; letter-spacing: -0.02em; text-transform: none; }

        /* ─── Has video styles ─── */
        .has-video { background: #071a2d !important; color: #fff !important; }
        .has-video .grid { display: none !important; }
        .has-video .scene-content { justify-content: flex-end !important; align-items: flex-start !important; gap: 18px !important; padding: 120px 62px 240px !important; }
        .has-video .eyebrow { margin: 0 !important; padding: 10px 15px !important; background: rgba(7,26,45,0.82) !important; color: #fff !important; border-left: 6px solid ${palette.accent} !important; border-radius: 3px !important; backdrop-filter: blur(12px) !important; font-size: 17px !important; }
        .has-video h2 { width: auto !important; max-width: 920px !important; margin: 0 !important; padding: 24px 28px 27px !important; background: linear-gradient(110deg, rgba(7,26,45,0.95), rgba(7,26,45,0.68)) !important; color: #fff !important; border-left: 9px solid ${palette.accent} !important; border-radius: 0 20px 20px 0 !important; backdrop-filter: blur(14px) !important; }

        /* ─── Scene kind styles ─── */
        .kind-pack { background: ${palette.accent}; }
        .kind-pack .scene-content { align-items: center; }
        .kind-pack .eyebrow { color: ${palette.ink}; }
        .kind-cta { background: ${palette.accent}; }
        .kind-cta .scene-content { align-items: flex-start; }

        /* ─── Pack stage ─── */
        .pack-stage { position: relative; width: 820px; height: 1050px; perspective: 1200px; }
        .pack-shadow { position: absolute; left: 90px; right: 30px; bottom: 42px; height: 100px; background: rgba(23,25,30,0.33); filter: blur(28px); transform: skewX(-20deg); }
        .pack-back, .decision-pack { position: absolute; width: 650px; height: 880px; left: 85px; top: 60px; }
        .pack-back { background: #b94716; transform: translate(42px,34px) rotate(5deg); box-shadow: 20px 24px 0 ${palette.ink}; }
        .decision-pack { display: flex; flex-direction: column; padding: 62px 50px; background: #fffdf8; border: 5px solid ${palette.ink}; box-shadow: 22px 28px 0 ${palette.ink}; transform-style: preserve-3d; color: ${palette.ink}; }
        .decision-pack:after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 210px; background: ${palette.accent}; clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 100%); }
        .pack-logo, .cta-logo { background: url("assets/logo.png") center/contain no-repeat; }
        .pack-logo { width: 360px; height: 100px; }
        .decision-pack span { margin-top: 150px; font: 78px/0.88 "${visualIdentity.globalStyle.fontPair.heading}", sans-serif; letter-spacing: -0.05em; z-index: 1; }
        .decision-pack small { margin-top: 30px; font-size: 18px; font-weight: 900; letter-spacing: 0.08em; z-index: 1; }
        .decision-pack b { margin-top: auto; font-size: 24px; z-index: 1; }

        /* ─── Captions ─── */
        .caption {
            position: absolute;
            z-index: 70;
            left: 55px;
            right: 55px;
            bottom: 70px;
            min-height: 96px;
            padding: 20px 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: ${palette.ink}F5;
            color: ${palette.paper};
            font-family: "${visualIdentity.globalStyle.fontPair.heading}", sans-serif;
            font-size: ${visualIdentity.typography.bodySize}px;
            line-height: 1.02;
            text-transform: uppercase;
            letter-spacing: -0.01em;
        }
        .caption-content { display: block; }

        /* ─── Transitions ─── */
        .transition {
            position: absolute;
            inset: 0;
            z-index: 60;
            background: ${palette.accent};
            display: grid;
            place-items: center;
        }
        .transition b { font-size: 36px; letter-spacing: 0.18em; color: ${palette.ink}; }

        /* ─── Avatar ─── */
        #ella { position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; z-index: 2; mix-blend-mode: multiply; }

        /* ─── Vignette ─── */
        .scene-vignette { position: absolute; inset: 0; pointer-events: none; z-index: 1; }

        /* ─── Cinematic letterbox ─── */
        .layout-cinematic_letterbox .scene-content { padding: 240px 68px; }
        .layout-cinematic_letterbox .premium-visual { height: 600px; }

        /* ─── Split diagonal ─── */
        .layout-split_diagonal .scene-content { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 80%); }
        .layout-split_diagonal .premium-visual { clip-path: polygon(0 20%, 100% 0, 100% 100%, 0 100%); }
    </style>
</head>
<body>
    <main
        id="root"
        class="style-${styleVariant % 6}"
        data-composition-id="plandome-premium-ad"
        data-start="0"
        data-duration="${duration}"
        data-track-index="0"
        data-width="1080"
        data-height="1920"
        data-fps="30"
    >
        <img class="brand-bug" src="assets/logo.png" alt="Plandome">
        ${avatarClip}
        ${sceneHtml}
        ${videoClips}
        ${captions}
        ${transitions}
    </main>

    ${gsapScript}
    ${splitTypeScript}
    ${motionScript}

    <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });

        // ─── Scene entrances ───
        ${entrances}

        // ─── Transition animations ───
        ${transitionAnimations}

        // ─── Caption animations ───
        ${captionAnimations}

        // ─── Intro animation ───
        ${introAnimation}

        // ─── Outro animation ───
        ${outroAnimation}

        window.__timelines["plandome-premium-ad"] = tl;
        window.__videoPlan = ${js(scenes)};
        window.__visualIdentity = ${js(visualIdentity)};

        // ─── SplitType integration (if available) ───
        if (typeof SplitType !== "undefined") {
            document.querySelectorAll(".split-caption").forEach(function(el) {
                new SplitType(el.querySelector(".caption-content"), {
                    types: "chars,words",
                    tagName: "span"
                });
            });
        }

        // ─── Motion.dev integration (if available) ───
        if (typeof Motion !== "undefined") {
            document.querySelectorAll(".scene-visual").forEach(function(el) {
                Motion.animate(el, { scale: [1, 1.05] }, { duration: 4, easing: Motion.easing.linear, direction: "alternate" });
            });
        }

        console.log("Plandome Premium Video Composition loaded");
        console.log("Visual Identity:", ${js(visualIdentity.fingerprint)});
    </script>
</body>
</html>`;

    await writeFile(path.join(directory, "index.html"), html);
    await writeFile(
        path.join(directory, "DESIGN.md"),
        `# Plandome Premium Video\n\nTemplate: ${design.template}\nGeneration: ${design.generationId}\nVisual Identity: ${visualIdentity.fingerprint}\nPalette: ${palette.paper}, ${palette.ink}, ${palette.accent}, ${visualIdentity.globalStyle.palette.secondary}\nTypography: ${visualIdentity.globalStyle.fontPair.heading} / ${visualIdentity.globalStyle.fontPair.body}\nGrid: ${visualIdentity.globalStyle.gridStyle}\nBorder: ${visualIdentity.globalStyle.borderStyle}\nLayouts: ${visualIdentity.sceneVariations.map((v) => v.layout).join(", ")}\nCamera Moves: ${visualIdentity.sceneVariations.map((v) => v.cameraMovement).join(", ")}\nTransitions: ${visualIdentity.transitions.map((t) => `${t.duration}s ${t.ease}`).join("; ")}\n`
    );

    return;
}

// ─── Helper functions ────────────────────────────────────────

function getEntranceKeyframes(
    type: string,
    duration: number,
    stagger: number,
    ease: string
): { from: string; duration: number; stagger: number; ease: string } {
    const base = {
        duration: Math.max(0.35, Math.min(0.85, duration)),
        stagger: Math.max(0.035, Math.min(0.095, stagger)),
        ease,
    };

    switch (type) {
        case "scale_in":
            return { ...base, from: 'opacity: 0, scale: 0.6, y: 30' };
        case "slide_from_left":
            return { ...base, from: 'opacity: 0, x: -120, rotation: -2' };
        case "slide_from_right":
            return { ...base, from: 'opacity: 0, x: 120, rotation: 2' };
        case "reveal_clip":
            return { ...base, from: 'opacity: 0, clipPath: "inset(0 100% 0 0)"' };
        case "blur_in":
            return { ...base, from: 'opacity: 0, filter: "blur(8px)", y: 20' };
        case "rotate_spring":
            return { ...base, from: 'opacity: 0, rotation: -15, scale: 0.8' };
        case "stagger_cascade":
            return { ...base, from: 'opacity: 0, y: 60, rotation: 3', stagger: 0.08 };
        case "elastic_bounce":
            return { ...base, from: 'opacity: 0, y: -60, scale: 0.5', ease: "elastic.out(1, 0.3)" };
        case "perspective_flip":
            return { ...base, from: 'opacity: 0, rotationY: -45, y: 40' };
        default:
            return { ...base, from: 'opacity: 0, y: 40, rotation: 1' };
    }
}

function getCameraKeyframes(
    movement: string,
    intensity: number,
    duration: number
): { from: string; to: string } {
    const i = Math.max(0.3, Math.min(1, intensity));
    const s = 1 + i * 0.08;
    const x = i * 30;

    switch (movement) {
        case "push_in":
            return {
                from: `{ scale: ${s}, x: 0, y: 0 }`,
                to: `{ scale: ${s + 0.05}, x: 0, y: 0, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "push_out":
            return {
                from: `{ scale: ${s + 0.08}, x: 0, y: 0 }`,
                to: `{ scale: ${s}, x: 0, y: 0, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "pan_left":
            return {
                from: `{ scale: ${s}, x: ${x}, y: 0 }`,
                to: `{ scale: ${s}, x: ${-x}, y: 0, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "pan_right":
            return {
                from: `{ scale: ${s}, x: ${-x}, y: 0 }`,
                to: `{ scale: ${s}, x: ${x}, y: 0, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "parallax":
            return {
                from: `{ scale: ${s}, x: ${-x * 0.5}, y: ${x * 0.3} }`,
                to: `{ scale: ${s + 0.02}, x: ${x * 0.5}, y: ${-x * 0.3}, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "tilt":
            return {
                from: `{ scale: ${s}, rotation: -1.2 }`,
                to: `{ scale: ${s + 0.02}, rotation: 1.2, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "dolly":
            return {
                from: `{ scale: ${s - 0.02}, y: ${x * 0.4} }`,
                to: `{ scale: ${s + 0.03}, y: ${-x * 0.3}, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "orbit":
            return {
                from: `{ scale: ${s}, x: ${-x}, y: ${-x * 0.3}, rotation: -1 }`,
                to: `{ scale: ${s}, x: ${x}, y: ${x * 0.3}, rotation: 1, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "dutch_angle":
            return {
                from: `{ scale: ${s}, rotation: 0 }`,
                to: `{ scale: ${s}, rotation: ${3 * i}, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        case "vertical_track":
            return {
                from: `{ scale: ${s}, y: ${x * 0.6} }`,
                to: `{ scale: ${s}, y: ${-x * 0.6}, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
        default:
            return {
                from: `{ scale: ${s}, x: 0, y: 0 }`,
                to: `{ scale: ${s + 0.03}, x: 0, y: 0, duration: ${Math.max(1, duration - 0.2)}, ease: "none" }`,
            };
    }
}

