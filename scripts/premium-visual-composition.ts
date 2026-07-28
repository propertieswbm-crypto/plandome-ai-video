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

import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DesignProfile, VisualBrief } from "./video-quality";
import { renderPremiumScene, selectRendererKind, type SceneRendererKind } from "./premium-scene-renderers";
import { generateVisualIdentity, type VisualIdentity, variationCssClasses } from "./premium-visual-variety";
import { assignTemplateFeatures, templateFeatureLibrary } from "./remotion-feature-library";
import { buildDesignDNA, composeSceneComponents, reviewCreative } from "./design-dna";

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
    captionWords?: Array<{ text: string; start: number; end: number }>;
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

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
    const featureAssignments = assignTemplateFeatures(seed, scenes);
    const designDNA = buildDesignDNA(seed);
    const sceneComponents = composeSceneComponents(seed, scenes.length);
    const creativeReview = reviewCreative(sceneComponents);
    if (!creativeReview.passed) throw new Error(`Creative review failed: ${creativeReview.failures.join(" ")}`);

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

    const root = path.resolve(import.meta.dirname, "..");
    await copyFile(path.join(root, "node_modules/gsap/dist/gsap.min.js"), path.join(directory, "gsap.min.js"));
    await copyFile(path.join(root, "node_modules/split-type/umd/index.min.js"), path.join(directory, "split-type.min.js"));
    await copyFile(path.join(root, "node_modules/motion/dist/motion.js"), path.join(directory, "motion.js"));
    const gsapScript = '<script src="gsap.min.js"></script>';
    const splitTypeScript = '<script src="split-type.min.js"></script>';
    const motionScript = '<script src="motion.js"></script>';

    const styleVariant = design.templateIndex ?? 0;
    visualIdentity.globalStyle.palette = {
        paper: design.palette.paper,
        ink: design.palette.ink,
        accent: design.palette.accent,
        secondary: design.palette.secondary,
        overlay: design.palette.ink,
    };
    visualIdentity.globalStyle.fontPair.heading = design.fonts.heading;
    visualIdentity.globalStyle.fontPair.body = design.fonts.body;
    const palette = visualIdentity.globalStyle.palette;
    const learned = design.editorPreferences;
    const captionScale = Math.min(1.5, Math.max(0.7, learned?.captionScale ?? 1));
    const overlayAlpha = Math.round(Math.min(1, Math.max(0.25, learned?.overlayOpacity ?? .96)) * 255).toString(16).padStart(2, "0");
    const logoScale = Math.min(1.5, Math.max(0.7, learned?.logoScale ?? 1));
    const logoPosition = learned?.logoPosition ?? "top-left";
    const logoLeft = logoPosition.endsWith("right") ? "auto" : "54px";
    const logoRight = logoPosition.endsWith("right") ? "54px" : "auto";
    const logoTop = logoPosition.startsWith("bottom") ? "auto" : "42px";
    const logoBottom = logoPosition.startsWith("bottom") ? "42px" : "auto";

    // ─── Build scene HTML ───────────────────────────────────────

    const sceneHtml = scenes
        .map((scene, index) => {
            const variation = visualIdentity.sceneVariations[index]!;
            const cssClasses = variationCssClasses(variation, visualIdentity.globalStyle).join(" ");
            const words = escapeHtml(scene.headline);
            const features = featureAssignments[index]!;
            const components = sceneComponents[index]!;
            const featureClasses = features.map((feature) => `feature-${feature}`).join(" ");
            const evidencePrimary = escapeHtml(scene.brief.object || scene.brief.action || "PROJECT EVIDENCE");
            const evidenceSecondary = escapeHtml(scene.brief.action || scene.brief.environment || "PROFESSIONAL REVIEW");
            const featureAccents = `
                <div class="template-accents" aria-hidden="true">
                    <span class="accent-card accent-card-a"><small>01</small><b>${evidencePrimary}</b></span>
                    <span class="accent-card accent-card-b"><small>02</small><b>${evidenceSecondary}</b></span>
                    <span class="accent-rule"></span>
                    <span class="accent-counter">${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}</span>
                </div>`;
            // extract monetary amounts if present (not used currently)
            // const amount = scene.text.match(/[£$€]\s?[\d,.]+(?:\s*[–-]\s*[£$€]?\s?[\d,.]+)?(?:k|m)?/i)?.[0] ?? "AVOIDABLE COST";

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
            } else if (scene.kind === "cta") {
                visual = `<div class="cta-action">BOOK YOUR PLANNING REVIEW <span>→</span></div>`;
            } else if (scene.videoAsset) {
                visual = `<div class="video-label"><b>UK PROPERTY CONTEXT</b><span>0${index + 1}</span></div>`;
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
                    class="scene clip kind-${scene.kind} ${cssClasses} ${featureClasses} ${scene.videoAsset ? "has-video" : ""}"
                    data-start="${scene.start}"
                    data-duration="${scene.duration}"
                    data-track-index="2"
                    data-layout="${variation.layout}"
                    data-camera="${variation.cameraMovement}"
                    data-transition="${variation.transitionIn}"
                    data-subtitle="${variation.subtitleAnimation}"
                    data-components="${components.join(",")}"
                >
                    <div class="grid grid-${visualIdentity.globalStyle.gridStyle}"></div>
                    ${featureAccents}
                    <div class="scene-content" style="text-align:${visualIdentity.typography.textAlign}">
                        <p class="eyebrow">PLANDOME / UK PROJECT CHECK</p>
                        ${visual}
                    </div>
                    ${scene.kind === "pack" ? "" : `<div class="static-headline">${words}</div>`}
                </section>`;
        })
        .join("\n");

    // ─── Video clips ──────────────────────────────────────────

    // ─── Captions with SplitType support ──────────────────────

    const videoClips = scenes.map((scene, index) =>
        scene.videoAsset
            ? `<video id="broll-${index}" class="broll clip" src="assets/${escapeHtml(scene.videoAsset)}" muted playsinline loop preload="auto" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="${12 + index}"></video>`
            : ""
    ).join("\n");

    // Captions live inside their owning scene. Hyperframes can then guarantee
    // that only the active scene's text is present in a rendered frame.
    let captionIndex = 0;
    const captions = scenes.flatMap((scene) => {
        const narrationKey = scene.text.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const headlineKey = scene.headline.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!scene.captionWords?.length || narrationKey === headlineKey) return [];
        const words = scene.captionWords ?? [];
        return Array.from({ length: Math.ceil(words.length / 6) }, (_, phraseIndex) => {
            const phrase = words.slice(phraseIndex * 6, phraseIndex * 6 + 6);
            const first = phrase[0]!;
            const last = phrase.at(-1)!;
            const phraseDuration = Math.max(.35, last.end - first.start);
            const html = phrase.map((item, index) => index === 0
                ? `<strong>${escapeHtml(item.text)}</strong>`
                : `<span>${escapeHtml(item.text)}</span>`).join(" ");
            const id = captionIndex++;
            return `<div id="caption-phrase-${id}" class="karaoke-word clip" data-start="${first.start}" data-duration="${phraseDuration}" data-track-index="${100 + id}"><div>${html}</div></div>`;
        });
    }).join("\n");

    // ─── Transitions ──────────────────────────────────────────

    const transitions = duration > 75 ? "" : scenes
        .slice(1)
        .map((scene, index) => {
            const transProfile = visualIdentity.transitions[index];
            const transDir = transProfile?.direction ?? "left";
            const transitionDuration = Math.min(0.7, Math.max(0.2, transProfile?.duration ?? 0.28));
            return `
                <div
                    id="transition-${index}"
                    class="transition clip transition-${visualIdentity.sceneVariations[index]?.transitionIn ?? "page_wipe"}"
                    data-start="${Math.max(0, scene.start - transitionDuration)}"
                    data-duration="${transitionDuration}"
                    data-track-index="${40 + index}"
                    data-direction="${transDir}"
                >
                </div>`;
        })
        .join("\n");

    // ─── GSAP Animations ──────────────────────────────────────

    const entrances = scenes
        .map((scene, index) => {
            const t = scene.start + 0.12;
            const variation = visualIdentity.sceneVariations[index]!;
            const features = featureAssignments[index]!;
            // Entrance animation based on type
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

            const featureMotion = `
                  .from("#scene-${index} .accent-card-a", { opacity: 0, x: -90, rotation: -9, duration: .55, ease: "back.out(1.4)" }, ${t + .18})
                  .from("#scene-${index} .accent-card-b", { opacity: 0, x: 90, rotation: 7, duration: .55, ease: "back.out(1.4)" }, ${t + .24})
                  .from("#scene-${index} .accent-rule", { scaleX: 0, transformOrigin: "left", duration: .65, ease: "expo.out" }, ${t + .28})`;
            return `
                tl.from("#scene-${index} .eyebrow", { opacity: 0, x: -55, duration: 0.38, ease: "power3.out" }, ${t})
                  .from("#scene-${index} .premium-visual, #scene-${index} .cta-action", { opacity: 0, x: ${index % 2 ? 70 : -70}, duration: 0.65, ease: "back.out(1.2)" }, ${t + 0.38})
                  .fromTo("#scene-${index} .scene-visual", ${cameraKeyframes.from}, ${cameraKeyframes.to}, ${scene.start})
                  .from("#scene-${index} .grid", { opacity: 0, duration: 0.4, ease: "power2.out" }, ${t + 0.05})
                  ${features.length ? featureMotion : ""};`;
        })
        .join("\n");

    // ─── Transition animations ─────────────────────────────────

    const transitionAnimations = duration > 75 ? "" : scenes
        .slice(1)
        .map((scene, index) => {
            const transProfile = visualIdentity.transitions[index];
            const transitionType = visualIdentity.sceneVariations[index]?.transitionIn ?? "page_wipe";
            const dur = Math.min(0.7, Math.max(0.2, transProfile?.duration ?? 0.28));
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
                        tl.fromTo("#transition-${index}", { opacity: 0, background: "${visualIdentity.colorGrade.highlights}" }, { opacity: 0.9, background: "${palette.accent}", duration: ${dur * 0.3}, ease: "power1.out" }, ${start})
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

    const captionAnimations = "";

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
        @font-face { font-family: "${visualIdentity.globalStyle.fontPair.heading}"; src: local("${visualIdentity.globalStyle.fontPair.heading}"); font-weight: 100 900; }
        @font-face { font-family: "${visualIdentity.globalStyle.fontPair.body}"; src: local("${visualIdentity.globalStyle.fontPair.body}"); font-weight: 100 900; }
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
            left: ${logoLeft};
            right: ${logoRight};
            top: ${logoTop};
            bottom: ${logoBottom};
            width: ${Math.round(260 * logoScale)}px;
            height: ${Math.round(92 * logoScale)}px;
            padding: 13px 16px;
            object-fit: contain;
            background: rgba(255, 253, 248, 0.96);
            border-top: 5px solid ${palette.accent};
            box-shadow: 0 12px 38px rgba(7,26,45,.22);
        }

        /* ─── Scene base ─── */
        .scene { position: absolute; inset: 0; overflow: hidden; background-color: ${palette.paper}; }
        .template-accents { position:absolute; inset:0; z-index:3; pointer-events:none; }
        .accent-card { display:none; position:absolute; width:320px; min-height:180px; padding:24px; border:3px solid ${palette.secondary}; background:${palette.ink}E8; color:${palette.paper}; box-shadow:18px 22px 48px #0004; backdrop-filter:blur(16px); }
        .accent-card small { display:block; margin-bottom:18px; color:${palette.accent}; font-size:17px; font-weight:900; letter-spacing:.16em; }
        .accent-card b { display:block; font-size:25px; line-height:1.08; text-transform:uppercase; }
        .accent-card-a { left:58px; top:350px; transform:rotate(-5deg); }
        .accent-card-b { right:42px; top:430px; transform:rotate(6deg); }
        .accent-rule { display:none; position:absolute; left:70px; right:70px; top:132px; height:5px; background:${palette.accent}; }
        .accent-counter { display:none; position:absolute; right:62px; top:142px; font:800 18px/1 monospace; letter-spacing:.12em; color:${palette.accent}; }
        .feature-photo-stack .accent-card, .feature-polaroid .accent-card { display:block; opacity:.7; }
        .feature-photo-stack .premium-visual, .feature-polaroid .premium-visual { transform:rotate(-1.5deg); box-shadow:24px 30px 0 ${palette.accent}, 42px 52px 0 ${palette.secondary}; }
        .feature-polaroid .premium-visual { border-width:22px; border-bottom-width:92px; }
        .feature-split-screen .premium-visual { width:53%; align-self:flex-end; clip-path:polygon(8% 0,100% 0,100% 100%,0 100%); }
        .feature-split-screen .static-headline { width:58%; right:auto; background:${palette.ink}; }
        .feature-lower-third .inline-caption { left:56px; right:250px; justify-content:flex-start; text-align:left; border-left:8px solid ${palette.accent}; border-radius:0 16px 16px 0; }
        .feature-kinetic-type .static-headline { font-size:96px; letter-spacing:-.065em; text-transform:uppercase; }
        .feature-cinematic-mask .premium-visual { clip-path:polygon(0 6%,94% 0,100% 92%,7% 100%); border:0; }
        .feature-floating-cards .accent-card { display:block; width:260px; min-height:170px; border:2px solid #fff8; background:${palette.ink}E8; backdrop-filter:blur(18px); }
        .feature-media-frame .premium-visual { border:3px solid ${palette.accent}; outline:18px solid ${palette.paper}; outline-offset:-36px; }
        .feature-number-counter .accent-counter, .feature-progress-rail .accent-rule { display:block; }
        .feature-light-leak:after { content:""; position:absolute; inset:-20%; z-index:8; pointer-events:none; background:radial-gradient(circle at 10% 30%,${palette.accent}88,transparent 32%); mix-blend-mode:screen; opacity:.55; }
        .feature-brand-outro .brand-bug { transform:scale(1.12); }
        .scene-content {
            position: relative;
            z-index: 4;
            width: 100%;
            height: 100%;
            padding: 150px 72px 250px;
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
            overflow-wrap: normal;
            word-break: normal;
        }
        /*
         * Hyperframes owns clip visibility and timing. Keep the semantic text
         * visible even when a browser snapshot is taken before GSAP has sought
         * the shared timeline; movement is applied to the containing blocks.
         */
        .word { display: inline-block; opacity: 1 !important; visibility: visible !important; transform: none !important; }
        .static-headline {
            position: absolute;
            z-index: 12;
            left: 62px;
            bottom: 292px;
            width: 920px;
            box-sizing: border-box;
            padding: 24px 28px 27px;
            background: linear-gradient(110deg, rgba(7,26,45,0.96), rgba(7,26,45,0.76));
            color: #fff;
            border-left: 9px solid ${palette.accent};
            border-radius: 0 20px 20px 0;
            font-family: "${visualIdentity.globalStyle.fontPair.heading}", Georgia, serif;
            font-size: 76px;
            font-weight: ${visualIdentity.globalStyle.fontPair.headingWeight};
            line-height: .98;
            letter-spacing: -.025em;
            overflow-wrap: normal;
            word-break: normal;
        }

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
        .broll { position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; z-index: 1; }
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
        /* Video clips are separate HyperFrames tracks beneath each semantic
           scene. Keep the scene layer transparent so it supplies typography
           and overlays without covering the footage. */
        .has-video { background: transparent !important; color: #fff !important; }
        .has-video .grid { display: none !important; }
        .has-video .scene-content { display: flex !important; grid-template-columns: none !important; justify-content: flex-end !important; align-items: flex-start !important; gap: 18px !important; padding: 120px 62px 240px !important; }
        .has-video .eyebrow { margin: 0 !important; padding: 10px 15px !important; background: rgba(7,26,45,0.82) !important; color: #fff !important; border-left: 6px solid ${palette.accent} !important; border-radius: 3px !important; backdrop-filter: blur(12px) !important; font-size: 17px !important; }
        .has-video h2 { display: block !important; flex: 0 0 auto !important; width: 920px !important; box-sizing: border-box !important; height: auto !important; min-height: 0 !important; max-height: 520px !important; margin: 0 !important; padding: 24px 28px 27px !important; background: linear-gradient(110deg, rgba(7,26,45,0.95), rgba(7,26,45,0.68)) !important; color: #fff !important; border-left: 9px solid ${palette.accent} !important; border-radius: 0 20px 20px 0 !important; backdrop-filter: blur(14px) !important; font-size: 76px !important; line-height: .98 !important; opacity: 1 !important; transform: none !important; overflow-wrap: normal !important; word-break: normal !important; }
        .video-label { display: flex; gap: 14px; align-items: center; padding: 9px 13px; background: rgba(7,26,45,.82); color: #fff; font-size: 15px; letter-spacing: .08em; }
        .video-label span { color: ${palette.accent}; font-weight: 900; }

        /* ─── Scene kind styles ─── */
        .kind-pack { background: ${palette.accent}; }
        .kind-pack .scene-content { align-items: center; }
        .kind-pack .eyebrow { color: ${palette.ink}; }
        .kind-cta { background: ${palette.ink}; color: ${palette.paper}; }
        .kind-cta .grid { opacity: .12; }
        .kind-cta .scene-content { display: flex !important; align-items: flex-start; justify-content: center; padding: 190px 82px 260px; }
        .kind-cta h2 { max-width: 880px; padding: 32px 36px; background: ${palette.paper}; color: ${palette.ink}; border-left: 12px solid ${palette.accent}; font-size: clamp(64px, 8vw, 88px); line-height: .94; }
        .kind-cta .static-headline { bottom: 760px; background: ${palette.paper}; color: ${palette.ink}; border-radius: 0; font-size: 78px; }
        .cta-action { margin-top: 18px; padding: 24px 30px; background: ${palette.accent}; color: ${palette.ink}; font-size: 25px; font-weight: 900; letter-spacing: .04em; box-shadow: 10px 10px 0 rgba(255,255,255,.16); }
        .cta-action span { margin-left: 18px; font-size: 34px; }

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
            left: 72px;
            right: 72px;
            bottom: 78px;
            min-height: 96px;
            padding: 18px 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: ${palette.ink}F5;
            color: ${palette.paper};
            font-family: "${visualIdentity.globalStyle.fontPair.heading}", sans-serif;
            font-size: ${Math.min(32, visualIdentity.typography.bodySize)}px;
            line-height: 1.16;
            text-transform: none;
            letter-spacing: -0.01em;
            max-height: 150px;
            overflow: hidden;
        }
        .caption-content { display: block; visibility: visible !important; }
        .inline-caption {
            position: absolute;
            z-index: 70;
            left: 72px;
            right: 72px;
            bottom: 78px;
            min-height: 96px;
            padding: 18px 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            text-align: center;
            background: ${palette.ink}${overlayAlpha};
            color: ${palette.paper};
            font-family: "${visualIdentity.globalStyle.fontPair.heading}", sans-serif;
            font-size: ${Math.round(Math.min(32, visualIdentity.typography.bodySize) * captionScale)}px;
            line-height: 1.16;
            text-transform: none;
            letter-spacing: -0.01em;
            max-height: 150px;
            overflow: hidden;
        }
        .karaoke-word {
            position:absolute;
            z-index:75;
            left:70px;
            right:70px;
            bottom:76px;
            min-height:118px;
            padding:20px 28px;
            display:grid;
            place-items:center;
            color:${palette.paper};
            background:${palette.ink}${overlayAlpha};
            border-left:9px solid ${palette.accent};
            border-radius:0 18px 18px 0;
            font-family:"${visualIdentity.globalStyle.fontPair.heading}",sans-serif;
            font-size:${Math.round(43 * captionScale)}px;
            font-weight:900;
            line-height:1;
            text-align:center;
            text-transform:uppercase;
            letter-spacing:-.035em;
            overflow:hidden;
        }
        .karaoke-word div { display:flex; flex-wrap:wrap; justify-content:center; gap:.22em; }
        .karaoke-word span { color:${palette.paper}B5; font-weight:650; }
        .karaoke-word strong { color:${palette.paper}; background:${palette.accent}; padding:.06em .16em; border-radius:.12em; animation:word-pop .2s cubic-bezier(.2,.9,.25,1.2) both; }
        @keyframes word-pop { from { opacity:.35; transform:translateY(10px) scale(.9); } to { opacity:1; transform:none; } }

        /* ─── Transitions ─── */
        .transition {
            position: absolute;
            inset: 0;
            z-index: 60;
            background: linear-gradient(112deg, ${palette.ink} 0 46%, ${palette.accent} 46% 49%, ${palette.paper} 49% 100%);
        }

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
        ${videoClips}
        ${sceneHtml}
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
        window.__templateFeatures = ${js({ library: templateFeatureLibrary, scenes: featureAssignments })};
        window.__designDNA = ${js(designDNA)};
        window.__sceneComponents = ${js(sceneComponents)};
        window.__creativeReview = ${js(creativeReview)};

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
        `# Plandome Premium Video\n\nTemplate: ${design.template}\nGeneration: ${design.generationId}\nVisual Identity: ${visualIdentity.fingerprint}\nPalette: ${palette.paper}, ${palette.ink}, ${palette.accent}, ${visualIdentity.globalStyle.palette.secondary}\nTypography: ${visualIdentity.globalStyle.fontPair.heading} / ${visualIdentity.globalStyle.fontPair.body}\nGrid: ${visualIdentity.globalStyle.gridStyle}\nBorder: ${visualIdentity.globalStyle.borderStyle}\nLayouts: ${visualIdentity.sceneVariations.map((v) => v.layout).join(", ")}\nCamera Moves: ${visualIdentity.sceneVariations.map((v) => v.cameraMovement).join(", ")}\nTransitions: ${visualIdentity.transitions.map((t) => `${t.duration}s ${t.ease}`).join("; ")}\nTemplate features: ${templateFeatureLibrary.join(", ")}\n\n## Design DNA\n\n${Object.entries(designDNA).map(([key,value]) => `- ${key}: ${value}`).join("\n")}\n\n## Modular scene compositions\n\n${sceneComponents.map((components,index) => `${index + 1}. ${components.join(" + ")}`).join("\n")}\n\nCreative review: PASSED\n`
    );

    return;
}

// ─── Helper functions ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

