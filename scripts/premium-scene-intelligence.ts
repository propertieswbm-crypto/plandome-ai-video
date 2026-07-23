import { createHash } from "node:crypto";

/**
 * Premium Scene Intelligence — Deep semantic narration analyzer
 *
 * Transforms raw narration into rich visual directions.
 * Understands intent, extracts subjects, and maps to the most
 * relevant visual type from 20+ cinematic categories.
 */

export type VisualType =
    | "cinematic_video"
    | "drone_footage"
    | "close_up"
    | "blueprint_animation"
    | "architectural_drawing"
    | "uk_victorian_property"
    | "commercial_premises"
    | "planning_documents"
    | "council_paperwork"
    | "building_control_inspection"
    | "cad_drawing"
    | "structural_detail"
    | "soil_cross_section"
    | "tree_roots"
    | "drainage_system"
    | "map_satellite"
    | "3d_animation"
    | "infographic"
    | "macro_detail"
    | "document_reveal"
    | "aerial_view"
    | "lifestyle_property"
    | "architectural_interior"
    | "construction_site"
    | "before_after_split";

export type CameraPreset =
    | "slow_zoom_in"
    | "slow_zoom_out"
    | "parallax_left"
    | "parallax_right"
    | "camera_push"
    | "camera_pull"
    | "orbit_left"
    | "orbit_right"
    | "tilt_up"
    | "tilt_down"
    | "pan_left"
    | "pan_right"
    | "rack_focus"
    | "dolly_zoom"
    | "dutch_angle"
    | "light_sweep"
    | "vertical_reveal"
    | "reverse_vertical_reveal"
    | "ken_burns_in"
    | "ken_burns_out";

export interface VisualDirection {
    subject: string;
    environment: string;
    action: string;
    visualType: VisualType;
    cameraPreset: CameraPreset;
    shotType: string;
    lighting: string;
    framing: string;
    motionIntensity: number; // 0.0 – 1.0
    depthOfField: "shallow" | "medium" | "deep";
    colorPalette: string[];
    searchQuery: string;
    reasoning: string;
}

export interface SceneIntelligence {
    sceneId: string;
    narration: string;
    durationSeconds: number;
    direction: VisualDirection;
    confidence: number; // 0.0 – 1.0
}

// ─── Core intelligence ─────────────────────────────────────

const VISUAL_TYPE_RULES: Array<{
    type: VisualType;
    keywords: RegExp[];
    subjectGen: (text: string) => string;
    environmentGen: (text: string) => string;
    actionGen: (text: string) => string;
    searchQueryGen: (text: string) => string;
}> = [
        {
            type: "drone_footage",
            keywords: [/view/, /overview/, /panoramic/, /street/, /neighbourhood/, /area/, /location/i],
            subjectGen: () => "a sweeping aerial view of a UK residential street and its surroundings",
            environmentGen: (t) => t.includes("commercial") ? "a mixed-use UK high street with period shopfronts" : "a traditional British residential street with Victorian and Edwardian terraces",
            actionGen: () => "revealing the property context and immediate neighbourhood character in a single establishing drone move",
            searchQueryGen: (t) => t.includes("commercial") ? "aerial view high street London UK" : "aerial Victorian terraced houses London UK"
        },
        {
            type: "uk_victorian_property",
            keywords: [/property/, /house/, /home/, /building/, /terraced/, /terrace/, /victorian/i],
            subjectGen: () => "an authentic Victorian terraced house with original brickwork, sash windows and period detailing",
            environmentGen: () => "a tree-lined residential street in a desirable London or UK commuter neighbourhood",
            actionGen: () => "standing proudly as an example of premium British architectural heritage, bathed in soft natural daylight",
            searchQueryGen: () => "Victorian terraced house London UK brickwork"
        },
        {
            type: "planning_documents",
            keywords: [/planning/, /permission/, /application/, /submit/, /proposal/, /scheme/, /drawing/, /consent/i],
            subjectGen: () => "detailed UK planning application drawings with proposed floor plans, elevations and site sections",
            environmentGen: () => "a professional architectural studio desk with natural light and reference materials",
            actionGen: () => "being reviewed and annotated by an experienced planning consultant",
            searchQueryGen: () => "UK planning application architectural drawings"
        },
        {
            type: "architectural_drawing",
            keywords: [/architect/, /design/, /drawing/, /plan/, /blueprint/, /elevation/, /section/i],
            subjectGen: () => "professional architectural drawings showing proposed designs with precise measurements and annotations",
            environmentGen: () => "a bright modern architect's studio with drawing boards and reference samples",
            actionGen: () => "being carefully studied during the design development phase",
            searchQueryGen: () => "architectural drawing elevation UK property"
        },
        {
            type: "blueprint_animation",
            keywords: [/structural/, /engineer/, /foundation/, /steel/, /beam/, /load/, /frame/i],
            subjectGen: () => "animated structural engineering diagrams revealing the hidden framework of a residential building",
            environmentGen: () => "a clean technical environment with blue-toned lighting and engineering reference materials",
            actionGen: () => "animating through layers from foundation to roof structure",
            searchQueryGen: () => "structural engineering blueprint UK building"
        },
        {
            type: "close_up",
            keywords: [/detail/, /feature/, /finish/, /material/, /brick/, /stone/, /wood/, /tile/, /craftsmanship/i],
            subjectGen: () => "the exquisite architectural detailing and material quality of a premium UK property",
            environmentGen: () => "natural daylight highlighting the texture and craftsmanship of original period features",
            actionGen: () => "revealing the quality and condition through a slow cinematic close-up",
            searchQueryGen: () => "architectural detail Victorian property UK close up"
        },
        {
            type: "construction_site",
            keywords: [/build/, /construction/, /contractor/, /site/, /development/, /underway/, /dig/i],
            subjectGen: () => "a professionally managed UK construction site with skilled tradespeople and modern equipment",
            environmentGen: () => "an active residential development site with scaffolding, materials and safety signage",
            actionGen: () => "showing the progression of construction with careful project management",
            searchQueryGen: () => "UK residential construction site professional"
        },
        {
            type: "building_control_inspection",
            keywords: [/inspection/, /building control/, /regulation/, /compliance/, /survey/, /check/, /approve/i],
            subjectGen: () => "a qualified building control officer conducting a thorough site inspection",
            environmentGen: () => "an active construction site with exposed structural elements ready for inspection",
            actionGen: () => "carefully examining the workmanship and materials against approved plans and building regulations",
            searchQueryGen: () => "building control inspection UK construction site"
        },
        {
            type: "commercial_premises",
            keywords: [/commercial/, /office/, /shop/, /retail/, /restaurant/, /high street/, /business/i],
            subjectGen: () => "a prominent British commercial property with professional shopfront or office entrance",
            environmentGen: () => "a thriving UK high street or business district with pedestrian activity and period architecture",
            actionGen: () => "presenting a prime commercial opportunity in an established trading location",
            searchQueryGen: () => "British commercial high street property shopfront"
        },
        {
            type: "architectural_interior",
            keywords: [/interior/, /room/, /space/, /living/, /kitchen/, /bathroom/, /open.?plan/, /light/i],
            subjectGen: () => "a light-filled premium interior space with high ceilings and period proportions",
            environmentGen: () => "a thoughtfully designed UK property interior blending original features with modern finishes",
            actionGen: () => "showcasing the spatial quality through a controlled interior tracking shot",
            searchQueryGen: () => "Victorian house interior renovation London UK"
        },
        {
            type: "structural_detail",
            keywords: [/foundation/, /wall/, /party wall/, /cavity/, /insulation/, /damp/, /tie/, /crack/i],
            subjectGen: () => "a close examination of the property's structural fabric revealing critical construction details",
            environmentGen: () => "a partially exposed section of a Victorian building showing original and modified construction",
            actionGen: () => "documenting the structural condition with professional precision",
            searchQueryGen: () => "Victorian house structural detail UK construction"
        },
        {
            type: "soil_cross_section",
            keywords: [/soil/, /ground/, /subsidence/, /heave/, /clay/, /shrinkable/, /ground condition/i],
            subjectGen: () => "a scientific cross-section of London clay soil showing the geological layers beneath a property",
            environmentGen: () => "a geotechnical survey environment with soil samples and analysis equipment",
            actionGen: () => "illustrating the ground conditions that affect foundation design and structural stability",
            searchQueryGen: () => "soil cross section London clay geotechnical"
        },
        {
            type: "tree_roots",
            keywords: [/tree/, /root/, /vegetation/, /plant/, /garden/, /subsidence caused by/i],
            subjectGen: () => "mature tree roots extending beneath a residential property, illustrating potential structural impact",
            environmentGen: () => "a garden with mature trees adjacent to a Victorian terrace showing the proximity of vegetation to buildings",
            actionGen: () => "visualising the underground root system and its relationship to the building foundation",
            searchQueryGen: () => "tree roots foundation damage UK property"
        },
        {
            type: "drainage_system",
            keywords: [/drain/, /sewer/, /pipe/, /water/, /flood/, /rainwater/, /gully/, /soakaway/i],
            subjectGen: () => "a detailed view of the property's drainage infrastructure including pipes, gullies and inspection chambers",
            environmentGen: () => "a below-ground drainage survey showing the network of pipes serving the property",
            actionGen: () => "tracing the drainage route from the building to the main sewer connection",
            searchQueryGen: () => "drainage system UK property underground pipes"
        },
        {
            type: "before_after_split",
            keywords: [/before/, /after/, /transformation/, /conversion/, /renovation/, /improvement/, /change/i],
            subjectGen: () => "a dramatic side-by-side comparison showing the property transformation",
            environmentGen: () => "matching perspectives captured in consistent lighting to show the full extent of change",
            actionGen: () => "revealing the before and after states through a controlled split-screen reveal animation",
            searchQueryGen: () => "UK house renovation before after extension"
        },
        {
            type: "document_reveal",
            keywords: [/report/, /survey/, /document/, /certificate/, /letter/, /paperwork/, /form/i],
            subjectGen: () => "official UK property documents and professional reports presented on a clean desk",
            environmentGen: () => "a professional consultancy environment with documents, stamps and reference materials",
            actionGen: () => "revealing the key findings and recommendations through a controlled document reveal motion",
            searchQueryGen: () => "UK property survey report document"
        },
        {
            type: "infographic",
            keywords: [/cost/, /budget/, /finance/, /saving/, /value/, /price/, /money/, /investment/, /profit/i],
            subjectGen: () => "a premium animated infographic presenting key financial data and project economics",
            environmentGen: () => "a clean professional environment with restrained colour palette and typography",
            actionGen: () => "animating through the financial narrative with clear data visualisation",
            searchQueryGen: () => "property finance infographic UK investment"
        },
        {
            type: "lifestyle_property",
            keywords: [/family/, /garden/, /living/, /enjoy/, /lifestyle/, /community/, /school/i],
            subjectGen: () => "a warm aspirational view of family life centred around a beautiful period property",
            environmentGen: () => "an inviting garden or family living space that showcases the lifestyle potential",
            actionGen: () => "capturing the essence of comfortable family living in a premium UK home",
            searchQueryGen: () => "family home garden Victorian house UK lifestyle"
        },
        {
            type: "cinematic_video",
            keywords: [/welcome/, /introducing/, /presenting/, /discover/, /explore/, /journey/i],
            subjectGen: () => "a cinematic establishing sequence that sets the tone for a premium property presentation",
            environmentGen: () => "a carefully composed environment that captures the essence of British property excellence",
            actionGen: () => "drawing the viewer into the narrative through an elegant cinematic camera move",
            searchQueryGen: () => "cinematic property film London UK premium"
        }
    ];

const CAMERA_PRESETS: CameraPreset[] = [
    "slow_zoom_in", "slow_zoom_out", "parallax_left", "parallax_right",
    "camera_push", "camera_pull", "orbit_left", "orbit_right",
    "tilt_up", "tilt_down", "pan_left", "pan_right",
    "rack_focus", "dolly_zoom", "dutch_angle", "light_sweep",
    "vertical_reveal", "reverse_vertical_reveal", "ken_burns_in", "ken_burns_out"
];

const LIGHTING_PRESETS = [
    "soft natural daylight with warm tones",
    "golden hour warm sunlight with long shadows",
    "overcast diffused light with soft shadows",
    "dramatic architectural lighting with contrast",
    "bright morning light with clean blue sky",
    "warm interior lighting with natural window light",
    "cool technical lighting for document detail",
    "moody cinematic lighting with controlled shadows"
];

const SHOT_TYPES = [
    "wide architectural establishing shot",
    "medium establishing shot with context",
    "medium close-up with detail",
    "extreme close-up macro detail",
    "overhead desk shot with shallow depth of field",
    "three-quarter exterior view",
    "tracking interior reveal shot",
    "aerial establishing shot",
    "low angle heroic shot",
    "eye-level documentary shot"
];

const FRAMING_PRESETS = [
    "centered symmetrical composition",
    "off-centre rule of thirds",
    "leading lines into the frame",
    "framed through architectural element",
    "dynamic diagonal composition",
    "layered foreground-midground-background",
    "tight frame on subject",
    "wide negative space composition"
];

// ─── Scene duration estimation ─────────────────────────────

function estimateDuration(narration: string): number {
    const wordCount = narration.split(/\s+/).filter(Boolean).length;
    // Professional voiceover: ~2.5 words per second
    const raw = wordCount / 2.5;
    // Clamp to 2–6 second range for visual beats
    return Math.max(2.4, Math.min(5.8, Math.round(raw * 10) / 10));
}

// ─── Scene ID generation ───────────────────────────────────

function generateSceneId(index: number): string {
    return `scene-${String(index + 1).padStart(2, "0")}`;
}

// ─── Stable pseudo-random selection ─────────────────────────

function stablePick<T>(items: readonly T[], seed: string, salt: number): T {
    const hash = createHash("sha256")
        .update(`${seed}:${salt}`)
        .digest("hex");
    const index = Number.parseInt(hash.slice(0, 8), 16) % items.length;
    return items[index]!;
}

// ─── Main intelligence function ─────────────────────────────

function analyseNarration(
    narration: string,
    sceneIndex: number,
    fullScript?: string
): VisualDirection {
    const seed = narration.slice(0, 40);
    const matchedRule = VISUAL_TYPE_RULES.find((rule) =>
        rule.keywords.some((kw) => kw.test(narration))
    );

    if (matchedRule) {
        return {
            subject: matchedRule.subjectGen(narration),
            environment: matchedRule.environmentGen(narration),
            action: matchedRule.actionGen(narration),
            visualType: matchedRule.type,
            cameraPreset: stablePick(CAMERA_PRESETS, seed, sceneIndex),
            shotType: stablePick(SHOT_TYPES, seed, sceneIndex + 100),
            lighting: stablePick(LIGHTING_PRESETS, seed, sceneIndex + 200),
            framing: stablePick(FRAMING_PRESETS, seed, sceneIndex + 300),
            motionIntensity: 0.3 + (Number.parseInt(
                createHash("sha256").update(`${seed}:motion`).digest("hex").slice(0, 4),
                16
            ) % 70) / 100,
            depthOfField: stablePick(["shallow", "medium", "deep"] as const, seed, sceneIndex + 400),
            colorPalette: ["#F5EFE3", "#101B2D", "#B87333", "#FFFFFF"],
            searchQuery: matchedRule.searchQueryGen(narration),
            reasoning: `Matched visual type '${matchedRule.type}' based on keywords in narration`
        };
    }

    // Fallback: infer from full script context or use generic cinematic
    const hasScriptContext = fullScript && fullScript.length > narration.length * 2;
    const contextHint = hasScriptContext
        ? fullScript!.toLowerCase()
        : narration.toLowerCase();

    if (/cost|budget|profit|value|£|money/i.test(contextHint)) {
        return {
            subject: "a premium animated financial infographic",
            environment: "a clean professional presentation environment",
            action: "presenting key financial data and project economics",
            visualType: "infographic",
            cameraPreset: stablePick(CAMERA_PRESETS, seed, sceneIndex),
            shotType: "overhead desk shot with shallow depth of field",
            lighting: "cool technical lighting for document detail",
            framing: "centered symmetrical composition",
            motionIntensity: 0.5,
            depthOfField: "deep",
            colorPalette: ["#101B2D", "#F5EFE3", "#B87333", "#FFFFFF"],
            searchQuery: "UK property financial infographic investment",
            reasoning: "Financial context detected, using infographic visual type"
        };
    }

    if (/planning|council|permission|approval|application/i.test(contextHint)) {
        return {
            subject: "detailed planning application documents being professionally reviewed",
            environment: "a bright architectural studio with planning drawings on the desk",
            action: "a consultant carefully reviewing planning documents and making notes",
            visualType: "planning_documents",
            cameraPreset: stablePick(CAMERA_PRESETS, seed, sceneIndex),
            shotType: "overhead desk shot with shallow depth of field",
            lighting: "bright morning light with clean blue sky",
            framing: "leading lines into the frame",
            motionIntensity: 0.3,
            depthOfField: "shallow",
            colorPalette: ["#F5EFE3", "#101B2D", "#8E6F45", "#FFFFFF"],
            searchQuery: "UK planning application documents review",
            reasoning: "Planning context detected, using document visual type"
        };
    }

    // Generic premium fallback
    const visualType = stablePick(
        ["cinematic_video", "uk_victorian_property", "architectural_drawing", "aerial_view"] as VisualType[],
        seed,
        sceneIndex
    );

    return {
        subject: "a premium British property in its architectural context",
        environment: "a traditional UK residential street with period architecture",
        action: "presenting the property as a premium architectural opportunity",
        visualType,
        cameraPreset: stablePick(CAMERA_PRESETS, seed, sceneIndex),
        shotType: stablePick(SHOT_TYPES, seed, sceneIndex + 100),
        lighting: stablePick(LIGHTING_PRESETS, seed, sceneIndex + 200),
        framing: stablePick(FRAMING_PRESETS, seed, sceneIndex + 300),
        motionIntensity: 0.4,
        depthOfField: "medium",
        colorPalette: ["#F5EFE3", "#101B2D", "#B87333", "#FFFFFF"],
        searchQuery: "UK Victorian terraced house premium property",
        reasoning: `No specific visual type matched; defaulting to '${visualType}' based on seed`
    };
}

// ─── Public API ─────────────────────────────────────────────

export function analyseAllScenes(
    script: string,
    fullScript?: string
): SceneIntelligence[] {
    if (!script || !script.trim()) {
        throw new Error("A non-empty script is required for scene analysis.");
    }

    // Split script into logical beats
    const clean = script.trim();
    const sentences = clean
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

    // Merge very short sentences
    const merged: string[] = [];
    for (const sentence of sentences) {
        const words = sentence.split(/\s+/).length;
        if (words < 5 && merged.length > 0) {
            merged[merged.length - 1] += " " + sentence;
        } else {
            merged.push(sentence);
        }
    }

    return merged.map((narration, index) => {
        const direction = analyseNarration(narration, index, fullScript || script);
        const confidence = direction.visualType === "cinematic_video" ? 0.65 : 0.85;

        return {
            sceneId: generateSceneId(index),
            narration,
            durationSeconds: estimateDuration(narration),
            direction,
            confidence
        };
    });
}

export function analyseSingleScene(
    narration: string,
    sceneIndex: number,
    fullScript?: string
): SceneIntelligence {
    const direction = analyseNarration(narration, sceneIndex, fullScript);
    const confidence = direction.visualType === "cinematic_video" ? 0.65 : 0.85;

    return {
        sceneId: generateSceneId(sceneIndex),
        narration,
        durationSeconds: estimateDuration(narration),
        direction,
        confidence
    };
}

export function getSearchQueriesFromScene(
    scene: SceneIntelligence
): string[] {
    const base = scene.direction.searchQuery;
    const variations = [
        base,
        `${scene.direction.subject} ${scene.direction.environment}`,
        `${scene.direction.visualType.replace(/_/g, " ")} ${scene.direction.subject}`,
        `UK ${scene.direction.visualType.replace(/_/g, " ")}`
    ];
    return [...new Set(variations)];
}

