/**
 * Premium Scene Renderers
 *
 * High-fidelity scene renderers with procedural textures,
 * real architectural details, and cinematic depth.
 * These replace the basic SVG/HTML scene renderers with
 * professionally designed composition layers.
 *
 * Uses: Three.js concepts via procedural CSS, Canvas 2D,
 * and SVG for premium visual quality without external dependencies.
 */

import { createHash } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────

export type SceneRendererKind =
    | "property_hero"
    | "property_detail"
    | "planning_document"
    | "structural_diagram"
    | "soil_section"
    | "tree_risk"
    | "drainage_map"
    | "cost_infographic"
    | "timeline_chart"
    | "compliance_check"
    | "before_after"
    | "blueprint_animation"
    | "aerial_context"
    | "interior_space"
    | "commercial_frontage"
    | "lifestyle_moment"
    | "document_reveal"
    | "architectural_drawing";

export interface SceneRendererConfig {
    kind: SceneRendererKind;
    seed: number;
    sceneIndex: number;
    totalScenes: number;
    palette: {
        paper: string;
        ink: string;
        accent: string;
        secondary: string;
    };
    narration: string;
    headline: string;
    subject: string;
    environment: string;
    motionIntensity: number;
}

// ─── Procedural Scene Generators ─────────────────────────────────────

/**
 * Generates a premium procedural scene as an SVG string.
 * Each renderer produces a unique, branded, cinematic visual.
 */
export function renderPremiumScene(config: SceneRendererConfig): string {
    switch (config.kind) {
        case "property_hero":
            return renderPropertyHero(config);
        case "property_detail":
            return renderPropertyDetail(config);
        case "planning_document":
            return renderPlanningDocument(config);
        case "structural_diagram":
            return renderStructuralDiagram(config);
        case "soil_section":
            return renderSoilSection(config);
        case "tree_risk":
            return renderTreeRisk(config);
        case "drainage_map":
            return renderDrainageMap(config);
        case "cost_infographic":
            return renderCostInfographic(config);
        case "timeline_chart":
            return renderTimelineChart(config);
        case "compliance_check":
            return renderComplianceCheck(config);
        case "before_after":
            return renderBeforeAfter(config);
        case "blueprint_animation":
            return renderBlueprintAnimation(config);
        case "aerial_context":
            return renderAerialContext(config);
        case "interior_space":
            return renderInteriorSpace(config);
        case "commercial_frontage":
            return renderCommercialFrontage(config);
        case "lifestyle_moment":
            return renderLifestyleMoment(config);
        case "document_reveal":
            return renderDocumentReveal(config);
        case "architectural_drawing":
            return renderArchitecturalDrawing(config);
        default:
            return renderPropertyHero(config);
    }
}

// ─── Seeded helpers ───────────────────────────────────────────────────

function seededHash(seed: number, salt: string): number {
    const h = createHash("sha256")
        .update(`${seed}:${salt}`)
        .digest("hex");
    return Number.parseInt(h.slice(0, 8), 16);
}

function seededChoice<T>(seed: number, salt: string, choices: readonly T[]): T {
    return choices[seededHash(seed, salt) % choices.length]!;
}

function seededFloat(seed: number, salt: string, min: number, max: number): number {
    const h = seededHash(seed, salt);
    return min + (h / 0xFFFFFFFF) * (max - min);
}

function seededInt(seed: number, salt: string, min: number, max: number): number {
    return min + (seededHash(seed, salt) % (max - min + 1));
}

// ─── Individual Renderers ─────────────────────────────────────────────

function renderPropertyHero(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const roofColor = seededChoice(seed, "roof", ["#443832", "#5A4A3E", "#3D3430", "#4E3F36"]);
    const brickColor = seededChoice(seed, "brick", ["#8E4737", "#9E5A46", "#7D3F32", "#A8654E"]);
    const skyGradient = seededChoice(seed, "sky", [
        "radial-gradient(circle at 78% 18%,#fff7df 0 8%,rgba(255,247,223,0) 9%),#b8ced0",
        "radial-gradient(circle at 65% 22%,#ffe9c4 0 10%,rgba(255,233,196,0) 11%),#aac4cf",
        "radial-gradient(circle at 82% 15%,#fef0d5 0 7%,rgba(254,240,213,0) 8%),#c5d5db",
    ]);
    const doorColor = seededChoice(seed, "door", ["#253D3B", "#1A3A36", "#2D4A43", "#1E3533"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0;background:${skyGradient};opacity:0.8"></div>
      <div class="scene-ken-burns" style="position:absolute;inset:-5%">
        <div style="position:absolute;left:10%;right:10%;bottom:18%;height:58%">
          <div style="position:absolute;inset:0;background:${brickColor};border-radius:8px 8px 0 0;box-shadow:0 40px 80px rgba(0,0,0,0.4)"></div>
          <div style="position:absolute;left:5%;right:5%;top:18%;height:28%;background:${roofColor};clip-path:polygon(3% 100%,15% 0,85% 0,97% 100%);box-shadow:0 -10px 30px rgba(0,0,0,0.2)"></div>
          <div style="position:absolute;right:28%;top:-8%;width:8%;height:22%;background:${roofColor};border-radius:2px"></div>
          <div style="position:absolute;left:42%;right:42%;bottom:0;height:38%;background:${doorColor};border:6px solid ${palette.secondary};border-radius:4px 4px 0 0"></div>
          <div style="position:absolute;left:16%;width:16%;height:24%;bottom:44%;background:#9FC1C9;border:5px solid ${palette.secondary};border-radius:2px;opacity:0.7"></div>
          <div style="position:absolute;right:16%;width:16%;height:24%;bottom:44%;background:#9FC1C9;border:5px solid ${palette.secondary};border-radius:2px;opacity:0.7"></div>
          <div style="position:absolute;left:16%;bottom:44%;width:16%;border-top:3px solid ${palette.secondary}88;transform:translateY(50%)"></div>
          <div style="position:absolute;bottom:44%;left:24%;height:24%;border-left:3px solid ${palette.secondary}88"></div>
          <div style="position:absolute;right:16%;bottom:44%;width:16%;border-top:3px solid ${palette.secondary}88;transform:translateY(50%)"></div>
          <div style="position:absolute;bottom:44%;right:24%;height:24%;border-left:3px solid ${palette.secondary}88"></div>
        </div>
      </div>
      <div style="position:absolute;left:8%;bottom:8%;padding:14px 22px;background:${palette.paper};color:${palette.ink};font:700 22px 'Archivo Black',sans-serif;letter-spacing:0.08em;box-shadow:8px 8px 0 ${palette.accent}">UK RESIDENTIAL</div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.5),inset 0 0 80px rgba(0,0,0,0.3);pointer-events:none"></div>
    </div>`;
}

function renderPropertyDetail(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const hasCrack = seededInt(seed, "crack", 0, 1) === 1;
    const detailType = seededChoice(seed, "detail", ["brickwork", "window", "cornice", "foundation"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:-3%">
        <div style="position:absolute;inset:8% 5%">
          <div style="position:absolute;inset:0;background:${seededChoice(seed, "brick2", ["#8E4737", "#9E5A46", "#7D3F32"])};border-radius:4px">
            ${Array.from({ length: 8 }, (_, r) => `
              <div style="position:absolute;left:4%;right:4%;top:${8 + r * 11}%;height:8%;background:${seededChoice(seed, `mortar-${r}`, ["#C49A8B", "#B8897A", "#D4A89B"])};opacity:0.3"></div>
            `).join("")}
          </div>
          ${detailType === "window" ? `
          <div style="position:absolute;left:25%;right:25%;top:15%;bottom:25%;background:#2A4548;border:12px solid ${palette.secondary};border-radius:2px">
            <div style="position:absolute;left:0;right:0;top:50%;border-top:8px solid ${palette.secondary}88"></div>
            <div style="position:absolute;top:0;bottom:0;left:50%;border-left:8px solid ${palette.secondary}88"></div>
          </div>` : ""}
          ${detailType === "cornice" ? `
          <div style="position:absolute;left:2%;right:2%;top:2%;height:12%;background:linear-gradient(180deg,${palette.secondary},${palette.accent});border-radius:4px 4px 0 0;box-shadow:0 8px 24px rgba(0,0,0,0.3)"></div>
          <div style="position:absolute;left:2%;right:2%;top:14%;height:3%;background:${palette.accent};opacity:0.6"></div>` : ""}
          ${detailType === "foundation" ? `
          <div style="position:absolute;left:0;right:0;bottom:0;height:20%;background:#5A5A5A;border-top:8px solid #444"></div>
          <div style="position:absolute;left:20%;bottom:0;width:60%;height:15%;background:#6A6A6A;transform:translateY(80%)"></div>` : ""}
          ${hasCrack ? `
          <div style="position:absolute;left:48%;top:20%;width:4px;height:40%;background:${palette.paper};opacity:0.4;transform:rotate(12deg);border-radius:2px"></div>
          <div style="position:absolute;left:48%;top:54%;width:3px;height:15%;background:${palette.paper};opacity:0.3;transform:rotate(-18deg);border-radius:2px"></div>` : ""}
        </div>
      </div>
      <div style="position:absolute;right:8%;top:8%;padding:10px 18px;background:${palette.accent};color:${palette.paper};font:700 18px 'Archivo Black',sans-serif;letter-spacing:0.06em">DETAIL</div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,0.6);pointer-events:none"></div>
    </div>`;
}

function renderPlanningDocument(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const docRotation = seededFloat(seed, "doc-rot", -2.5, 2.5);
    const stampColor = seededChoice(seed, "stamp", ["#D05B3F", "#B87333", "#C9A227"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.paper}">
      <div class="scene-parallax-layer" style="position:absolute;inset:-2%">
        <div style="position:absolute;left:5%;right:5%;top:5%;bottom:10%;background:#FFFFFF;box-shadow:0 20px 60px rgba(0,0,0,0.15),0 8px 20px rgba(0,0,0,0.08);transform:rotate(${docRotation}deg)">
          <div style="position:absolute;left:6%;right:6%;top:5%;bottom:5%">
            <div style="display:flex;justify-content:space-between;border-bottom:3px solid ${palette.ink}22;padding-bottom:8%">
              <div><span style="font:700 16px 'Archivo Black',sans-serif;color:${palette.ink}">PLANNING APPLICATION</span></div>
              <div><span style="font:400 12px 'IBM Plex Mono',monospace;color:${palette.ink}66">REF: UK/${seededInt(seed, "ref1", 10000, 99999)}/${new Date().getFullYear()}</span></div>
            </div>
            ${Array.from({ length: 4 }, (_, i) => `
            <div style="margin-top:${4 + i * 2.5}%;padding:2% 0;border-bottom:1px solid ${palette.ink}15">
              <div style="height:${seededInt(seed, `line-${i}`, 14, 22)}px;width:${seededInt(seed, `w-${i}`, 40, 95)}%;background:${palette.ink}12;border-radius:2px"></div>
              <div style="height:12px;width:${seededInt(seed, `w2-${i}`, 30, 70)}%;background:${palette.ink}08;border-radius:2px;margin-top:6px"></div>
            </div>`).join("")}
            <div style="position:absolute;right:5%;bottom:8%;width:25%;height:18%;border:4px solid ${stampColor}88;border-radius:4px;display:grid;place-items:center;transform:rotate(-8deg)">
              <span style="font:700 20px 'Archivo Black',sans-serif;color:${stampColor}88;letter-spacing:0.08em">RECEIVED</span>
            </div>
            <div style="position:absolute;left:5%;bottom:8%;width:35%;height:3px;background:${palette.ink}15"></div>
          </div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(0,0,0,0.08);pointer-events:none"></div>
    </div>`;
}

function renderStructuralDiagram(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const beamCount = seededInt(seed, "beams", 3, 6);

    return `
    <div style="position:absolute;inset:0;background:#0B1A2E">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:8%">
          <div style="position:absolute;left:10%;right:10%;top:10%;bottom:10%;border:3px solid ${palette.accent}44">
            ${Array.from({ length: beamCount }, (_, i) => {
        const isVertical = i % 2 === 0;
        const pos = 12 + (i * 72) / beamCount;
        return `<div style="position:absolute;${isVertical ? `left:${pos}%;top:0;bottom:0;width:${4 + seededInt(seed, `bw-${i}`, 2, 6)}px` : `top:${pos}%;left:0;right:0;height:${4 + seededInt(seed, `bh-${i}`, 2, 6)}px`};background:${palette.accent}66;border-radius:2px;box-shadow:0 0 12px ${palette.accent}33"></div>`;
    }).join("")}
            <div style="position:absolute;left:20%;right:20%;bottom:25%;height:2px;background:${palette.paper}44"></div>
            <div style="position:absolute;left:20%;bottom:25%;width:2px;height:20%;background:${palette.paper}44"></div>
            <div style="position:absolute;right:20%;bottom:25%;width:2px;height:20%;background:${palette.paper}44"></div>
            <div style="position:absolute;left:20%;bottom:25%;width:2px;height:8px;background:${palette.accent}"></div>
            <div style="position:absolute;right:20%;bottom:25%;width:2px;height:8px;background:${palette.accent}"></div>
          </div>
          <div style="position:absolute;left:8%;bottom:6%;font:700 18px 'Archivo Black',sans-serif;color:${palette.accent};letter-spacing:0.06em">STRUCTURAL ANALYSIS</div>
          <div style="position:absolute;right:8%;bottom:6%;font:400 12px 'IBM Plex Mono',monospace;color:${palette.paper}66">UK BUILDING REGS</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.5);pointer-events:none"></div>
    </div>`;
}

function renderSoilSection(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const clayColor = seededChoice(seed, "clay", ["#A96E47", "#8D5E3E", "#B87D52", "#9C6A44"]);
    const subsoilColor = seededChoice(seed, "sub", ["#6E4938", "#5D3D2E", "#7D5542", "#634333"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;left:6%;right:6%;top:6%;bottom:8%">
          <div style="position:absolute;inset:0;border:3px solid ${palette.paper}22;border-radius:4px">
            <div style="position:absolute;inset:0">
              <div style="position:absolute;top:0;left:0;right:0;height:30%;background:linear-gradient(180deg,#7D8079,#5A5E58)">
                <span style="position:absolute;left:5%;bottom:8%;font:700 13px 'IBM Plex Mono',monospace;color:${palette.paper}88">TOPSOIL</span>
              </div>
              <div style="position:absolute;top:30%;left:0;right:0;height:35%;background:repeating-linear-gradient(135deg,${clayColor} 0 18px,${subsoilColor} 18px 36px)">
                <span style="position:absolute;left:5%;bottom:8%;font:700 13px 'IBM Plex Mono',monospace;color:${palette.paper}88">LONDON CLAY</span>
              </div>
              <div style="position:absolute;top:65%;left:0;right:0;height:35%;background:${subsoilColor}">
                <span style="position:absolute;left:5%;bottom:8%;font:700 13px 'IBM Plex Mono',monospace;color:${palette.paper}88">SUBSOIL / CHALK</span>
              </div>
              <div style="position:absolute;left:30%;right:30%;top:30%;bottom:0;border-left:3px dashed ${palette.accent}66;border-right:3px dashed ${palette.accent}66"></div>
            </div>
          </div>
          <div style="position:absolute;left:6%;bottom:2%;font:700 16px 'Archivo Black',sans-serif;color:${palette.accent}">GROUND CONDITION</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,0.3);pointer-events:none"></div>
    </div>`;
}

function renderTreeRisk(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const treeType = seededChoice(seed, "tree", ["oak", "lime", "poplar", "willow"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.paper}">
      <div class="scene-parallax-layer" style="position:absolute;inset:-3%">
        <div style="position:absolute;inset:5%">
          <div style="position:absolute;left:5%;bottom:10%;width:30%;height:75%">
            <div style="position:absolute;left:42%;bottom:0;width:16%;height:55%;background:#70452F;border-radius:4px 4px 0 0;transform:rotate(${seededFloat(seed, "trunk", -2, 2)}deg)">
              <div style="position:absolute;left:-40%;top:-15%;width:180%;height:55%;border-radius:48% 52% 44% 56%;background:${seededChoice(seed, "foliage", ["#31573C", "#3A6647", "#2A4D33"])};box-shadow:-20px 30px 0 #456C4822,25px 20px 0 #294B3422"></div>
            </div>
            ${Array.from({ length: 4 }, (_, i) => `
              <div style="position:absolute;left:44%;bottom:${12 + i * 12}%;width:${80 + seededInt(seed, `root-${i}`, 20, 80)}px;height:6px;background:#70452F;border-radius:2px;transform-origin:left;rotate:${seededFloat(seed, `ra-${i}`, -45, 45)}deg;box-shadow:0 0 0 2px ${palette.accent}44"></div>
            `).join("")}
          </div>
          <div style="position:absolute;right:3%;bottom:10%;width:55%;height:50%;background:#8E4737;border-radius:4px 4px 0 0;border:4px solid ${palette.secondary}">
            <div style="position:absolute;left:0;right:0;top:-20%;height:28%;background:#443832;clip-path:polygon(5% 100%,15% 0,85% 0,95% 100%)"></div>
            <div style="position:absolute;left:42%;bottom:0;width:18%;height:40%;background:#1A3A36;border:4px solid ${palette.secondary}"></div>
          </div>
          <div style="position:absolute;left:5%;bottom:10%;width:60%;height:3px;background:${palette.ink}22;border-radius:1px"></div>
          <div style="position:absolute;right:8%;bottom:6%;font:700 14px 'IBM Plex Mono',monospace;color:${palette.accent}">${treeType.toUpperCase()} / ROOT ZONE</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(0,0,0,0.1);pointer-events:none"></div>
    </div>`;
}

function renderDrainageMap(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const pipeColor = seededChoice(seed, "pipe", ["#25536A", "#1A4356", "#306A82"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:6%">
          <div style="position:absolute;inset:0;border:3px solid ${palette.paper}22;border-radius:4px">
            <svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%">
              <line x1="20" y1="20" x2="80" y2="20" stroke="${pipeColor}" stroke-width="3" stroke-dasharray="4,2"/>
              <line x1="80" y1="20" x2="80" y2="60" stroke="${pipeColor}" stroke-width="3"/>
              <line x1="80" y1="60" x2="30" y2="60" stroke="${pipeColor}" stroke-width="4"/>
              <line x1="30" y1="60" x2="30" y2="85" stroke="${pipeColor}" stroke-width="4"/>
              <line x1="40" y1="20" x2="40" y2="42" stroke="${pipeColor}" stroke-width="2.5" stroke-dasharray="3,2"/>
              <line x1="60" y1="20" x2="60" y2="42" stroke="${pipeColor}" stroke-width="2" stroke-dasharray="3,2"/>
              <circle cx="80" cy="20" r="4" fill="${palette.accent}"/>
              <circle cx="80" cy="60" r="4" fill="${palette.accent}"/>
              <circle cx="30" cy="60" r="5" fill="${palette.accent}"/>
              <circle cx="30" cy="85" r="5" fill="${palette.accent}"/>
              <rect x="18" y="5" width="4" height="17" fill="${palette.paper}44"/>
              <rect x="78" y="50" width="4" height="12" fill="${palette.paper}44"/>
            </svg>
          </div>
          <div style="position:absolute;left:6%;bottom:2%;font:700 16px 'Archivo Black',sans-serif;color:${palette.accent}">DRAINAGE SURVEY</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,0.3);pointer-events:none"></div>
    </div>`;
}

function renderCostInfographic(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const bars = [35, 52, 68, 78, 42, 61];

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:8% 6%">
          <div style="position:absolute;top:0;right:0;font:800 120px 'Archivo Black',sans-serif;color:${palette.accent};opacity:0.15;line-height:0.8">£</div>
          <div style="position:absolute;left:0;bottom:15%;right:5%;height:60%;display:flex;align-items:flex-end;gap:3%">
            ${bars.map((h, i) => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
                <div style="width:100%;height:${h}%;background:${i === bars.length - 1 ? palette.accent : palette.paper};opacity:${i === bars.length - 1 ? 1 : 0.5};border-radius:4px 4px 0 0;box-shadow:${i === bars.length - 1 ? `0 0 30px ${palette.accent}44` : "none"}"></div>
              </div>
            `).join("")}
          </div>
          <div style="position:absolute;left:0;bottom:6%;right:5%;height:2px;background:${palette.paper}22"></div>
          <div style="position:absolute;left:0;bottom:6%;width:2px;height:60%;background:${palette.paper}22"></div>
          <div style="position:absolute;left:6%;bottom:2%;font:700 16px 'Archivo Black',sans-serif;color:${palette.accent}">COST ANALYSIS</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.4);pointer-events:none"></div>
    </div>`;
}

function renderTimelineChart(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const phases = ["ASSESS", "DESIGN", "SUBMIT", "APPROVE", "BUILD"];

    return `
    <div style="position:absolute;inset:0;background:${palette.paper}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;left:8%;right:8%;top:50%;height:4px;background:${palette.ink}22;border-radius:2px"></div>
        ${phases.map((phase, i) => {
        const left = 8 + i * 20;
        const topOffset = i % 2 === 0 ? -15 : 12;
        return `
            <div style="position:absolute;left:${left}%;top:${50 + topOffset}%;transform:translate(-50%,-50%);text-align:center">
              <div style="width:${seededInt(seed, `dot-${i}`, 40, 56)}px;height:${seededInt(seed, `dot-${i}`, 40, 56)}px;border-radius:50%;background:${i >= 3 ? palette.accent : palette.ink};border:${i >= 3 ? "none" : `4px solid ${palette.paper}`};box-shadow:0 0 0 ${i >= 3 ? "6px" : "4px"} ${i >= 3 ? palette.accent : palette.ink};margin:0 auto ${topOffset > 0 ? "16px" : ""}"></div>
              <span style="display:block;margin-top:${topOffset > 0 ? "0" : "16px"};font:700 ${i >= 3 ? "16px" : "14px"} 'Archivo Black',sans-serif;color:${i >= 3 ? palette.accent : palette.ink}">${phase}</span>
            </div>`;
    }).join("")}
        <div style="position:absolute;left:6%;bottom:6%;font:700 16px 'Archivo Black',sans-serif;color:${palette.ink}">PROJECT TIMELINE</div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 100px rgba(0,0,0,0.06);pointer-events:none"></div>
    </div>`;
}

function renderComplianceCheck(config: SceneRendererConfig): string {
    const { palette, seed } = config;

    return `
    <div style="position:absolute;inset:0;background:linear-gradient(145deg,${palette.ink},${seededChoice(seed, "grad", ["#1A3A45", "#152C3D", "#1E3F4E"])})">
      <div class="scene-parallax-layer" style="position:absolute;inset:0;display:grid;place-items:center">
        <div style="position:relative">
          <div style="width:${seededInt(seed, "circle", 180, 260)}px;height:${seededInt(seed, "circle2", 180, 260)}px;border-radius:50%;border:6px solid ${palette.accent};display:grid;place-items:center;box-shadow:0 0 60px ${palette.accent}33,0 0 120px ${palette.accent}15">
            <span style="font:900 120px 'Archivo Black',sans-serif;color:${palette.paper};line-height:1">✓</span>
          </div>
          <div style="position:absolute;left:50%;bottom:-40px;transform:translateX(-50%);width:max-content;font:700 14px 'IBM Plex Mono',monospace;color:${palette.accent};letter-spacing:0.12em;white-space:nowrap">COMPLIANCE VERIFIED</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,0.3);pointer-events:none"></div>
    </div>`;
}

function renderBeforeAfter(config: SceneRendererConfig): string {
    const { palette, seed } = config;

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:6%">
          <div style="position:absolute;left:0;top:0;width:48%;height:70%;border:3px solid ${palette.paper}33;border-radius:4px;overflow:hidden">
            <div style="position:absolute;inset:0;background:${palette.ink}">
              <div style="position:absolute;left:10%;right:10%;bottom:10%;height:50%;background:#6E4938;border-radius:2px"></div>
              <div style="position:absolute;left:30%;right:30%;top:8%;height:22%;background:#443832;clip-path:polygon(5% 100%,15% 0,85% 0,95% 100%)"></div>
            </div>
            <span style="position:absolute;left:8px;top:8px;font:700 12px 'IBM Plex Mono',monospace;color:${palette.paper}88">BEFORE</span>
          </div>
          <div style="position:absolute;right:0;top:0;width:48%;height:70%;border:3px solid ${palette.accent};border-radius:4px;overflow:hidden">
            <div style="position:absolute;inset:0;background:${palette.paper}">
              <div style="position:absolute;left:10%;right:10%;bottom:10%;height:52%;background:#8E4737;border-radius:2px;box-shadow:0 4px 20px rgba(0,0,0,0.2)"></div>
              <div style="position:absolute;left:8%;right:8%;top:6%;height:24%;background:#443832;clip-path:polygon(3% 100%,12% 0,88% 0,97% 100%)"></div>
              <div style="position:absolute;right:-5%;bottom:10%;width:25%;height:25%;background:#8E4737;border:3px solid ${palette.secondary};border-radius:2px"></div>
            </div>
            <span style="position:absolute;right:8px;top:8px;font:700 12px 'IBM Plex Mono',monospace;color:${palette.accent}">AFTER</span>
          </div>
          <div style="position:absolute;left:50%;top:35%;transform:translate(-50%,-50%);font:700 28px 'Archivo Black',sans-serif;color:${palette.accent};text-shadow:0 0 20px rgba(0,0,0,0.5)">VS</div>
          <div style="position:absolute;left:6%;bottom:4%;font:700 16px 'Archivo Black',sans-serif;color:${palette.accent}">TRANSFORMATION</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,0.4);pointer-events:none"></div>
    </div>`;
}

function renderBlueprintAnimation(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const blueColor = "#163452";
    const lineColor = seededChoice(seed, "blue-line", ["#F5EAD7", "#D9E8EE", "#E8DDCC"]);

    return `
    <div style="position:absolute;inset:0;background:${blueColor}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:4%;border:2px solid ${lineColor}22">
          <svg viewBox="0 0 100 100" style="position:absolute;inset:2%;width:96%;height:96%">
            <rect x="15" y="15" width="70" height="55" fill="none" stroke="${lineColor}" stroke-width="0.8" opacity="0.6"/>
            <line x1="15" y1="30" x2="85" y2="30" stroke="${lineColor}" stroke-width="0.5" opacity="0.4"/>
            <line x1="15" y1="45" x2="85" y2="45" stroke="${lineColor}" stroke-width="0.5" opacity="0.4"/>
            <line x1="15" y1="60" x2="85" y2="60" stroke="${lineColor}" stroke-width="0.5" opacity="0.4"/>
            <line x1="50" y1="15" x2="50" y2="70" stroke="${lineColor}" stroke-width="0.5" opacity="0.4"/>
            <rect x="25" y="22" width="12" height="12" fill="none" stroke="${lineColor}" stroke-width="0.8" opacity="0.5"/>
            <rect x="63" y="22" width="12" height="12" fill="none" stroke="${lineColor}" stroke-width="0.8" opacity="0.5"/>
            <rect x="38" y="40" width="24" height="30" fill="none" stroke="${lineColor}" stroke-width="0.8" opacity="0.5"/>
            <circle cx="75" cy="22" r="3" fill="none" stroke="${lineColor}" stroke-width="0.6" opacity="0.4"/>
            ${Array.from({ length: 6 }, (_, i) => {
        const x = 10 + i * 14;
        return `<circle cx="${x}" cy="78" r="1.5" fill="${palette.accent}" opacity="0.3"/>`;
    }).join("")}
            <text x="20" y="88" fill="${lineColor}" font-size="3" opacity="0.5" font-family="monospace">DRAWING: UK-PROP-${seededInt(seed, "drawing-no", 100, 999)}</text>
            <text x="70" y="88" fill="${lineColor}" font-size="2.5" opacity="0.4" font-family="monospace">SCALE 1:50</text>
          </svg>
          ${Array.from({ length: 8 }, (_, i) => {
        const x = 6 + i * 11;
        return `<div style="position:absolute;left:${x}%;bottom:2%;width:2px;height:6px;background:${lineColor}33;border-radius:1px"></div>`;
    }).join("")}
        </div>
        <div style="position:absolute;left:6%;bottom:4%;font:700 16px 'Archivo Black',sans-serif;color:${lineColor}">PLAN DRAWING</div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 100px rgba(0,0,0,0.3);pointer-events:none"></div>
    </div>`;
}

function renderAerialContext(config: SceneRendererConfig): string {
    const { palette, seed } = config;

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:5%">
          <svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%">
            ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 4 }, (_, c) => {
        const x = 8 + c * 22;
        const y = 8 + r * 14;
        const isHighlighted = r === 2 && c === 1;
        return `<rect x="${x}" y="${y}" width="14" height="10" fill="${isHighlighted ? palette.accent : palette.paper}" opacity="${isHighlighted ? 0.9 : 0.15}" rx="1"/>`;
    }).join("")).join("")}
            <line x1="5" y1="5" x2="95" y2="5" stroke="${palette.paper}" stroke-width="0.5" opacity="0.2"/>
            <line x1="5" y1="95" x2="95" y2="95" stroke="${palette.paper}" stroke-width="0.5" opacity="0.2"/>
            <line x1="5" y1="5" x2="5" y2="95" stroke="${palette.paper}" stroke-width="0.5" opacity="0.2"/>
            <line x1="95" y1="5" x2="95" y2="95" stroke="${palette.paper}" stroke-width="0.5" opacity="0.2"/>
          </svg>
          <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border:3px solid ${palette.accent};border-radius:2px;box-shadow:0 0 30px ${palette.accent}44"></div>
          <div style="position:absolute;left:6%;bottom:4%;font:700 16px 'Archivo Black',sans-serif;color:${palette.paper}">AERIAL CONTEXT</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.5);pointer-events:none"></div>
    </div>`;
}

function renderInteriorSpace(config: SceneRendererConfig): string {
    const { palette, seed } = config;

    return `
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${palette.paper},#E8E0D0)">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:8%">
          <div style="position:absolute;left:0;right:0;top:0;height:100%">
            <div style="position:absolute;left:5%;right:5%;top:0;height:15%;background:${palette.paper};border-radius:2px;box-shadow:0 4px 12px rgba(0,0,0,0.05)"></div>
            <div style="position:absolute;left:5%;right:5%;top:15%;bottom:0;background:${palette.paper};border-radius:0 0 2px 2px;box-shadow:0 8px 30px rgba(0,0,0,0.06)">
              <div style="position:absolute;left:10%;right:10%;top:12%;bottom:10%;border:2px solid ${palette.ink}10"></div>
              <div style="position:absolute;left:10%;right:10%;top:12%;height:2px;background:${palette.ink}10"></div>
              <div style="position:absolute;left:15%;top:25%;width:30%;height:40%;border:2px solid ${palette.ink}08;border-radius:1px"></div>
              <div style="position:absolute;right:15%;top:25%;width:25%;height:40%;border:2px solid ${palette.ink}08;border-radius:1px"></div>
              <div style="position:absolute;left:10%;bottom:10%;right:10%;height:2px;background:${palette.ink}08"></div>
            </div>
            <div style="position:absolute;left:15%;top:8%;width:12px;height:12px;border-radius:50%;background:${palette.accent}44;box-shadow:0 0 20px ${palette.accent}22"></div>
          </div>
          <div style="position:absolute;left:6%;bottom:4%;font:700 16px 'Archivo Black',sans-serif;color:${palette.ink}">INTERIOR SPACE</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 100px rgba(0,0,0,0.06);pointer-events:none"></div>
    </div>`;
}

function renderCommercialFrontage(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const shopColor = seededChoice(seed, "shop", ["#193D42", "#1A3035", "#22454A"]);

    return `
    <div style="position:absolute;inset:0;background:${palette.paper}">
      <div class="scene-parallax-layer" style="position:absolute;inset:-2%">
        <div style="position:absolute;inset:6%">
          <div style="position:absolute;left:8%;right:8%;bottom:12%;height:65%">
            <div style="position:absolute;inset:0;background:#8E4737;border-radius:4px 4px 0 0;box-shadow:0 20px 40px rgba(0,0,0,0.15)"></div>
            <div style="position:absolute;left:0;right:0;top:-12%;height:18%;background:#443832;clip-path:polygon(2% 100%,10% 0,90% 0,98% 100%)"></div>
            <div style="position:absolute;left:5%;right:5%;bottom:0;height:28%;background:${shopColor};border:6px solid ${palette.secondary};border-bottom:0">
              <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 24px 'Archivo Black',sans-serif;color:${palette.secondary};letter-spacing:0.15em;opacity:0.7">COMMERCIAL</span>
            </div>
            <div style="position:absolute;left:5%;top:8%;right:5%;height:30%;background:#9FC1C9;border:5px solid ${palette.secondary};opacity:0.5"></div>
            <div style="position:absolute;left:5%;top:8%;right:5%;border-top:3px solid ${palette.secondary}66;transform:translateY(50%)"></div>
          </div>
          <div style="position:absolute;left:8%;bottom:5%;font:700 16px 'Archivo Black',sans-serif;color:${palette.ink}">COMMERCIAL FRONTAGE</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(0,0,0,0.08);pointer-events:none"></div>
    </div>`;
}

function renderLifestyleMoment(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const sky = seededChoice(seed, "sky-l", ["#FEF7E6", "#F5F0E3", "#FFF8ED", "#F0EBE0"]);

    return `
    <div style="position:absolute;inset:0;background:${sky}">
      <div class="scene-parallax-layer" style="position:absolute;inset:-2%">
        <div style="position:absolute;inset:5%">
          <div style="position:absolute;left:10%;right:10%;bottom:12%;height:52%">
            <div style="position:absolute;inset:0;background:#8E4737;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.1)"></div>
            <div style="position:absolute;left:0;right:0;top:-15%;height:25%;background:#443832;clip-path:polygon(5% 100%,15% 0,85% 0,95% 100%)"></div>
            <div style="position:absolute;left:42%;right:42%;bottom:0;height:32%;background:#1A3A36;border:4px solid ${palette.secondary}"></div>
            <div style="position:absolute;left:18%;top:10%;width:18%;height:25%;background:#9FC1C9;border:4px solid ${palette.secondary};opacity:0.6"></div>
            <div style="position:absolute;right:18%;top:10%;width:18%;height:25%;background:#9FC1C9;border:4px solid ${palette.secondary};opacity:0.6"></div>
          </div>
          <div style="position:absolute;left:22%;bottom:6%;width:12%;height:18%;background:repeating-linear-gradient(0deg,#31573C 0 4px,#3A6647 4px 8px);border-radius:2px"></div>
          <div style="position:absolute;left:18%;bottom:6%;width:4px;height:12%;background:#70452F;border-radius:1px"></div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 100px rgba(0,0,0,0.04);pointer-events:none"></div>
    </div>`;
}

function renderDocumentReveal(config: SceneRendererConfig): string {
    const { palette, seed } = config;

    return `
    <div style="position:absolute;inset:0;background:${palette.ink}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;left:10%;right:10%;top:12%;bottom:10%">
          <div style="position:absolute;inset:0;background:${palette.paper};border-radius:4px;box-shadow:0 20px 60px rgba(0,0,0,0.3);transform:rotate(${seededFloat(seed, "doc-r", -1.5, 1.5)}deg)">
            <div style="position:absolute;left:6%;right:6%;top:6%;bottom:6%">
              <div style="font:700 18px 'Archivo Black',sans-serif;color:${palette.ink};border-bottom:2px solid ${palette.accent};padding-bottom:4%">UK PROPERTY REPORT</div>
              <div style="margin-top:5%">
                ${Array.from({ length: 5 }, (_, i) => `
                  <div style="height:${seededInt(seed, `rl-${i}`, 10, 16)}px;width:${seededInt(seed, `rw-${i}`, 50, 95)}%;background:${palette.ink}10;margin-top:${seededInt(seed, `rm-${i}`, 8, 16)}px;border-radius:2px"></div>
                `).join("")}
              </div>
              <div style="position:absolute;right:5%;bottom:5%;padding:8px 16px;border:3px solid ${palette.accent}66;border-radius:2px;transform:rotate(-6deg)">
                <span style="font:700 14px 'Archivo Black',sans-serif;color:${palette.accent}66">CONFIDENTIAL</span>
              </div>
            </div>
          </div>
        </div>
        <div style="position:absolute;left:8%;bottom:4%;font:700 16px 'Archivo Black',sans-serif;color:${palette.paper}">DOCUMENT REVIEW</div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.5);pointer-events:none"></div>
    </div>`;
}

function renderArchitecturalDrawing(config: SceneRendererConfig): string {
    const { palette, seed } = config;
    const bgColor = seededChoice(seed, "arch-bg", ["#F5EFE3", "#F0E8D5", "#EDE5D0", "#F2ECD8"]);

    return `
    <div style="position:absolute;inset:0;background:${bgColor}">
      <div class="scene-parallax-layer" style="position:absolute;inset:0">
        <div style="position:absolute;inset:4%;border:2px solid ${palette.ink}15">
          <svg viewBox="0 0 100 100" style="position:absolute;inset:3%;width:94%;height:94%">
            <rect x="15" y="18" width="70" height="50" fill="none" stroke="${palette.ink}" stroke-width="0.6" opacity="0.5"/>
            <line x1="15" y1="30" x2="85" y2="30" stroke="${palette.ink}" stroke-width="0.3" opacity="0.3"/>
            <line x1="15" y1="42" x2="85" y2="42" stroke="${palette.ink}" stroke-width="0.3" opacity="0.3"/>
            <line x1="15" y1="54" x2="85" y2="54" stroke="${palette.ink}" stroke-width="0.3" opacity="0.3"/>
            <line x1="50" y1="18" x2="50" y2="68" stroke="${palette.ink}" stroke-width="0.3" opacity="0.3"/>
            <rect x="30" y="25" width="15" height="12" fill="none" stroke="${palette.ink}" stroke-width="0.5" opacity="0.4"/>
            <rect x="55" y="25" width="15" height="12" fill="none" stroke="${palette.ink}" stroke-width="0.5" opacity="0.4"/>
            <rect x="40" y="42" width="20" height="24" fill="none" stroke="${palette.ink}" stroke-width="0.5" opacity="0.4"/>
            <text x="20" y="82" fill="${palette.ink}" font-size="3" opacity="0.4" font-family="monospace">SECTION A-A</text>
            <text x="68" y="82" fill="${palette.ink}" font-size="2.5" opacity="0.3" font-family="monospace">SCALE 1:100</text>
          </svg>
          <div style="position:absolute;left:10px;bottom:10px;font:700 14px 'Archivo Black',sans-serif;color:${palette.ink}55">ARCHITECT'S DRAWING</div>
        </div>
      </div>
      <div class="scene-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 80px rgba(0,0,0,0.04);pointer-events:none"></div>
    </div>`;
}

/**
 * Returns the appropriate renderer kind based on narration analysis.
 */
export function selectRendererKind(
    subject: string,
    environment: string,
    narration: string,
    seed: number
): SceneRendererKind {
    const lower = narration.toLowerCase();

    if (/property|house|home|building|exterior|facade|street/i.test(lower)) return "property_hero";
    if (/detail|feature|brick|window|finish|material|craftsmanship/i.test(lower)) return "property_detail";
    if (/planning|permission|application|drawing|council|submit/i.test(lower)) return "planning_document";
    if (/structural|foundation|steel|beam|load|frame|engineer/i.test(lower)) return "structural_diagram";
    if (/soil|clay|ground|subsidence|geotechnical|heave/i.test(lower)) return "soil_section";
    if (/tree|root|vegetation|garden/i.test(lower)) return "tree_risk";
    if (/drain|sewer|pipe|water|flood|rainwater|soakaway/i.test(lower)) return "drainage_map";
    if (/cost|budget|finance|value|profit|price|investment|money/i.test(lower)) return "cost_infographic";
    if (/week|month|timeline|schedule|delay|deadline|programme/i.test(lower)) return "timeline_chart";
    if (/compliance|regulation|check|verify|approve|inspect/i.test(lower)) return "compliance_check";
    if (/before|after|transformation|renovation|conversion|change/i.test(lower)) return "before_after";
    if (/blueprint|cad|engineering|technical|drawing/i.test(lower)) return "blueprint_animation";
    if (/aerial|overview|location|neighbourhood|area|panoramic|view/i.test(lower)) return "aerial_context";
    if (/interior|room|space|living|kitchen|bathroom|open.?plan|light/i.test(lower)) return "interior_space";
    if (/commercial|office|shop|retail|high.?street|business/i.test(lower)) return "commercial_frontage";
    if (/family|garden|living|enjoy|lifestyle|community|school/i.test(lower)) return "lifestyle_moment";
    if (/report|survey|certificate|document|paperwork|letter/i.test(lower)) return "document_reveal";
    if (/architect|design|plan|elevation|section|drawing/i.test(lower)) return "architectural_drawing";

    // Fallback based on subject matter
    if (/commercial|office|shop|retail/i.test(subject)) return "commercial_frontage";
    if (/document|report|survey|paperwork/i.test(subject)) return "document_reveal";
    if (/property|house|home|building/i.test(subject)) return "property_hero";

    return "property_hero";
}

