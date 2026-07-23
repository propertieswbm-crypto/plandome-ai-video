/**
 * Premium Cinematic Motion Engine
 *
 * Provides 16+ cinematic camera movements using advanced ffmpeg
 * filter chains for premium commercial advertisement quality.
 *
 * Movements include: orbit, parallax, rack focus, light sweep,
 * dolly zoom, Dutch angle, push-in, pull-out, pan, tilt, etc.
 */

import { execFile } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type CameraPresetName =
    | "cinematic_push_in"
    | "cinematic_pull_out"
    | "parallax_pan_left"
    | "parallax_pan_right"
    | "dolly_zoom"
    | "dutch_angle_tilt"
    | "slow_orbit"
    | "rack_focus_reveal"
    | "light_sweep"
    | "vertical_tilt_up"
    | "vertical_tilt_down"
    | "blueprint_reveal"
    | "document_reveal"
    | "mask_transition"
    | "crane_up"
    | "crane_down"
    | "heroic_low_angle"
    | "aerial_descend"
    | "tracking_lateral"
    | "push_through";

export interface CameraPreset {
    name: CameraPresetName;
    label: string;
    description: string;
    intensity: "subtle" | "moderate" | "dynamic";
    idealDuration: [number, number]; // min, max seconds
}

export interface MotionConfig {
    preset: CameraPresetName;
    duration: number;
    seed: number;
    sceneIndex: number;
    totalScenes: number;
}

export const CAMERA_PRESETS: Record<CameraPresetName, CameraPreset> = {
    cinematic_push_in: {
        name: "cinematic_push_in",
        label: "Cinematic Push-In",
        description: "Slow, smooth dolly forward creating dramatic tension",
        intensity: "moderate",
        idealDuration: [3, 6],
    },
    cinematic_pull_out: {
        name: "cinematic_pull_out",
        label: "Cinematic Pull-Out",
        description: "Slow reveal pulling back from detail to full context",
        intensity: "moderate",
        idealDuration: [3, 6],
    },
    parallax_pan_left: {
        name: "parallax_pan_left",
        label: "Parallax Pan Left",
        description: "Lateral movement with foreground/background depth separation",
        intensity: "subtle",
        idealDuration: [3, 5],
    },
    parallax_pan_right: {
        name: "parallax_pan_right",
        label: "Parallax Pan Right",
        description: "Lateral movement right with parallax depth effect",
        intensity: "subtle",
        idealDuration: [3, 5],
    },
    dolly_zoom: {
        name: "dolly_zoom",
        label: "Dolly Zoom (Vertigo Effect)",
        description: "Camera moves forward while zooming out, creating dramatic perspective shift",
        intensity: "dynamic",
        idealDuration: [2, 4],
    },
    dutch_angle_tilt: {
        name: "dutch_angle_tilt",
        label: "Dutch Angle Tilt",
        description: "Gradual rotation creating unease or dramatic tension",
        intensity: "moderate",
        idealDuration: [2, 4],
    },
    slow_orbit: {
        name: "slow_orbit",
        label: "Slow Orbit",
        description: "Semi-circular orbit around subject revealing depth",
        intensity: "moderate",
        idealDuration: [4, 7],
    },
    rack_focus_reveal: {
        name: "rack_focus_reveal",
        label: "Rack Focus Reveal",
        description: "Focus shift from foreground to background or vice versa",
        intensity: "subtle",
        idealDuration: [2, 4],
    },
    light_sweep: {
        name: "light_sweep",
        label: "Light Sweep",
        description: "Animated light beam sweeping across scene revealing details",
        intensity: "subtle",
        idealDuration: [2, 4],
    },
    vertical_tilt_up: {
        name: "vertical_tilt_up",
        label: "Vertical Tilt Up",
        description: "Camera tilting upward revealing full building facade",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    vertical_tilt_down: {
        name: "vertical_tilt_down",
        label: "Vertical Tilt Down",
        description: "Camera tilting downward from roof to ground level",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    blueprint_reveal: {
        name: "blueprint_reveal",
        label: "Blueprint Reveal",
        description: "Animated drawing lines revealing architectural plan",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    document_reveal: {
        name: "document_reveal",
        label: "Document Reveal",
        description: "Paper sliding into frame with stamp imprint",
        intensity: "subtle",
        idealDuration: [2, 4],
    },
    mask_transition: {
        name: "mask_transition",
        label: "Mask Transition",
        description: "Circular or geometric mask reveal to next scene",
        intensity: "dynamic",
        idealDuration: [1, 3],
    },
    crane_up: {
        name: "crane_up",
        label: "Crane Up",
        description: "Camera rising vertically from ground to elevated view",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    crane_down: {
        name: "crane_down",
        label: "Crane Down",
        description: "Camera descending from elevated to ground view",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    heroic_low_angle: {
        name: "heroic_low_angle",
        label: "Heroic Low Angle",
        description: "Low angle push emphasizing building stature",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    aerial_descend: {
        name: "aerial_descend",
        label: "Aerial Descend",
        description: "Gradual descent from bird's eye to street level",
        intensity: "dynamic",
        idealDuration: [4, 7],
    },
    tracking_lateral: {
        name: "tracking_lateral",
        label: "Tracking Lateral",
        description: "Sideways tracking movement following the subject",
        intensity: "moderate",
        idealDuration: [3, 5],
    },
    push_through: {
        name: "push_through",
        label: "Push Through",
        description: "Camera pushes through an opening or portal",
        intensity: "dynamic",
        idealDuration: [2, 4],
    },
};

/**
 * Picks a camera preset based on scene context, avoiding recent presets.
 */
export function selectCameraPreset(
    sceneIndex: number,
    totalScenes: number,
    seed: number,
    recentPresets: CameraPresetName[] = []
): CameraPresetName {
    const presets = Object.keys(CAMERA_PRESETS) as CameraPresetName[];

    // Filter out recently used presets
    const available = presets.filter((p) => !recentPresets.slice(0, 3).includes(p));

    const pool = available.length > 0 ? available : presets;
    const hash = (seed + sceneIndex * 7 + totalScenes * 13) % pool.length;

    return pool[hash]!;
}

/**
 * Generates ffmpeg zoompan filter expression for the selected camera movement.
 */
export function buildZoompanFilter(
    preset: CameraPresetName,
    duration: number,
    width = 1080,
    height = 1920
): string {
    const fps = 30;
    const frames = Math.max(1, Math.round(duration * fps));

    switch (preset) {
        case "cinematic_push_in": {
            // Slow zoom in from 1.0x to 1.08x
            const zoom = "1+0.08*on/" + frames;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)", frames, width, height);
        }

        case "cinematic_pull_out": {
            // Pull out from 1.08x to 1.0x
            const zoom = "1.08-0.08*on/" + frames;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)", frames, width, height);
        }

        case "parallax_pan_left": {
            // Pan left with slight zoom
            const zoom = "1.06";
            const x = `max(0,iw-iw/${zoom}-${width * 0.15}*on/${frames})`;
            const y = "ih/2-(ih/zoom/2)";
            return buildZoompanExpression(zoom, x, y, frames, width, height);
        }

        case "parallax_pan_right": {
            // Pan right with slight zoom
            const zoom = "1.06";
            const x = `min(iw-iw/${zoom},${width * 0.15}*on/${frames})`;
            const y = "ih/2-(ih/zoom/2)";
            return buildZoompanExpression(zoom, x, y, frames, width, height);
        }

        case "dolly_zoom": {
            // Dramatic zoom combined with subtle scale change
            const zoom = "1+0.12*sin(PI*on/" + frames + ")";
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)", frames, width, height);
        }

        case "dutch_angle_tilt": {
            // Gradual rotation
            const rotate = `${3 * Math.sin(Date.now()) % 5}`;
            return `scale=${width}:${height * 2}:force_original_aspect_ratio=increase,crop=${width}:${height},rotate=${rotate}*PI/180:ow=${width}:oh=${height}:c=black`;
        }

        case "slow_orbit": {
            // Simulated orbit via combined zoom and pan
            const zoom = "1.04";
            const orbitRadius = width * 0.08;
            const x = `iw/2-(iw/${zoom}/2)+${orbitRadius}*sin(2*PI*on/${frames})`;
            const y = `ih/2-(ih/${zoom}/2)+${orbitRadius * 0.3}*cos(2*PI*on/${frames})`;
            return buildZoompanExpression(zoom, x, y, frames, width, height);
        }

        case "rack_focus_reveal": {
            // Simulated rack focus using gblur
            const blurStart = 8;
            const blurEnd = 0;
            const blurExpr = `${blurStart}-(${blurStart - blurEnd})*on/${frames}`;
            return `scale=${width}:${height * 2}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=${blurExpr}`;
        }

        case "light_sweep": {
            // Light sweep effect using overlay gradient
            const lightPos = `min(1,${frames > 0 ? `on/${frames}` : "0"}*1.3)`;
            return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},drawbox=x=iw*${lightPos}-iw*0.3:y=0:w=iw*0.6:h=ih:color=white@0.08:t=fill,drawbox=x=iw*${lightPos}-iw*0.05:y=0:w=iw*0.1:h=ih:color=white@0.2:t=fill`;
        }

        case "vertical_tilt_up": {
            // Tilt up - reveal from bottom to top
            const zoom = "1.05";
            const y = `max(0,ih-ih/${zoom}-${height * 0.2}*(${frames}-on)/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "vertical_tilt_down": {
            // Tilt down - reveal from top to bottom
            const zoom = "1.05";
            const y = `min(ih-ih/${zoom},${height * 0.2}*on/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "blueprint_reveal": {
            // Animated reveal with drawbox simulating drawing lines
            const progress = `on/${frames}`;
            return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},drawbox=x=0:y=0:w=iw*${progress}:h=ih:color=white@0.06:t=fill`;
        }

        case "document_reveal": {
            // Slide in from left
            return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},pad=iw*1.3:ih:(iw*1.3-iw)*(1-on/${frames}):0:color=black`;
        }

        case "mask_transition": {
            // Circular mask reveal
            const radius = `sqrt(iw^2+ih^2)/2*min(1,on/${frames}*1.2)`;
            return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},drawbox=x=iw/2-${radius}:y=ih/2-${radius}:w=${radius}*2:h=${radius}*2:color=white@0.3:t=fill`;
        }

        case "crane_up": {
            // Rising effect with zoom out
            const zoom = "1.06-0.04*on/" + frames;
            const y = `max(0,ih-ih/${zoom}-${height * 0.15}*on/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "crane_down": {
            // Descending effect with zoom in
            const zoom = "1.02+0.04*on/" + frames;
            const y = `min(ih-ih/${zoom},${height * 0.15}*(${frames}-on)/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "heroic_low_angle": {
            // Low angle push with slight upward tilt
            const zoom = "1+0.06*on/" + frames;
            const y = `max(0,ih-ih/${zoom}-${height * 0.05}*on/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "aerial_descend": {
            // Descend from zoomed out to closer view
            const zoom = "1.15-0.12*on/" + frames;
            const y = `max(0,ih-ih/${zoom}-${height * 0.2}*on/${frames})`;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", y, frames, width, height);
        }

        case "tracking_lateral": {
            // Smooth lateral tracking
            const zoom = "1.04";
            const x = `${width * 0.1}*sin(2*PI*on/${frames})`;
            return `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width}:${height}:${x}:0`;
        }

        case "push_through": {
            // Push through effect with scale
            const zoom = "1+0.1*on/" + frames;
            const x = `iw/2-(iw/${zoom}/2)+${width * 0.05}*on/${frames}`;
            return buildZoompanExpression(zoom, x, "ih/2-(ih/zoom/2)", frames, width, height);
        }

        default: {
            // Fallback: subtle cinematic push
            const zoom = "1+0.04*on/" + frames;
            return buildZoompanExpression(zoom, "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)", frames, width, height);
        }
    }
}

function buildZoompanExpression(
    zoom: string,
    x: string,
    y: string,
    frames: number,
    width: number,
    height: number
): string {
    return [
        `scale=${width}:${height * 2}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
        `zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=30`,
    ].join(",");
}

/**
 * Builds the complete ffmpeg filter chain for a still image to cinematic video.
 */
export function buildCinematicFilterChain(
    preset: CameraPresetName,
    duration: number,
    width = 1080,
    height = 1920
): string {
    const zoompan = buildZoompanFilter(preset, duration, width, height);

    // Post-processing color grade and film look
    const colorGrade = [
        "eq=contrast=1.06:saturation=0.92:brightness=-0.015:gamma=1.02",
        "unsharp=5:5:0.35:5:5:0.15",
        "format=yuv420p",
    ].join(",");

    return [zoompan, colorGrade].join(",");
}

/**
 * Converts a still image into a cinematic video clip using ffmpeg.
 */
export async function createCinematicClip(
    inputImage: string,
    outputPath: string,
    config: MotionConfig,
    width = 1080,
    height = 1920
): Promise<void> {
    const preset = config.preset;
    const duration = Math.max(2, Math.min(8, config.duration));
    const filterChain = buildCinematicFilterChain(preset, duration, width, height);

    await exec(
        process.env.FFMPEG_PATH || "ffmpeg",
        [
            "-y",
            "-loop", "1",
            "-framerate", "30",
            "-i", inputImage,
            "-vf", filterChain,
            "-t", duration.toFixed(3),
            "-an",
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            outputPath,
        ],
        { maxBuffer: 10_000_000 }
    );

    // Validate output
    const outputStat = await stat(outputPath);
    const minimumBytes = 150_000;

    if (outputStat.size < minimumBytes) {
        await unlink(outputPath).catch(() => undefined);
        throw new Error(
            `Cinematic clip was only ${outputStat.size} bytes (minimum: ${minimumBytes}).`
        );
    }
}

/**
 * Selects a diverse set of camera presets for all scenes, ensuring no two adjacent
 * scenes use the same or similar movement.
 */
export function assignScenePresets(
    sceneCount: number,
    seed: number
): CameraPresetName[] {
    const presets = Object.keys(CAMERA_PRESETS) as CameraPresetName[];
    const assigned: CameraPresetName[] = [];

    for (let i = 0; i < sceneCount; i++) {
        const recent = assigned.slice(-3);
        const available = presets.filter((p) => !recent.includes(p));

        // If we've used most presets, allow reuse with different adjacent context
        const pool = available.length > 0 ? available : presets;
        const hash = (seed + i * 13 + sceneCount * 7) % pool.length;
        assigned.push(pool[hash]!);
    }

    return assigned;
}

