import type { PlannedScene } from "./video-composition";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(content: string, label: string) {
  return `<div class="premium-visual" role="img" aria-label="${escapeHtml(label)}">${content}</div>`;
}

function propertyHero(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:linear-gradient(145deg,#071a2d,#173b55 55%,#d6a85a)">
      <div style="position:absolute;inset:7%;border:2px solid #ffffff55"></div>
      <svg viewBox="0 0 900 700" style="position:absolute;inset:8%;width:84%;height:84%">
        <defs>
          <linearGradient id="brick" x1="0" x2="1">
            <stop offset="0" stop-color="#7e3f32"/>
            <stop offset="1" stop-color="#b0654b"/>
          </linearGradient>
          <filter id="shadow"><feDropShadow dx="18" dy="22" stdDeviation="12" flood-opacity=".35"/></filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M145 575V245L450 95L755 245V575Z" fill="url(#brick)" stroke="#f7f1e5" stroke-width="8"/>
          <path d="M110 260L450 65L790 260L735 290L450 135L165 290Z" fill="#25282d"/>
          <rect x="406" y="385" width="95" height="190" fill="#122f39" stroke="#f7f1e5" stroke-width="9"/>
          <g fill="#9fc1c9" stroke="#f7f1e5" stroke-width="9">
            <rect x="215" y="310" width="125" height="125"/>
            <rect x="560" y="310" width="125" height="125"/>
          </g>
          <g stroke="#f7f1e5" stroke-width="5">
            <path d="M277 310V435M215 372H340M622 310V435M560 372H685"/>
          </g>
          <rect x="640" y="95" width="62" height="155" fill="#754335" stroke="#25282d" stroke-width="7"/>
        </g>
        <g fill="none" stroke="#d6a85a" stroke-width="4" stroke-dasharray="13 12">
          <path d="M80 620H820"/>
          <path d="M90 190V590"/>
          <path d="M810 190V590"/>
        </g>
      </svg>
      <div style="position:absolute;left:7%;bottom:7%;padding:18px 24px;background:#f8f4ec;color:#071a2d;font:800 24px Arial;letter-spacing:.12em">UK PROPERTY STUDY</div>
    </div>`, scene.brief.object);
}

function planningScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:#0b2239">
      <div style="position:absolute;inset:0;background-image:linear-gradient(#4d789033 1px,transparent 1px),linear-gradient(90deg,#4d789033 1px,transparent 1px);background-size:42px 42px"></div>
      <svg viewBox="0 0 900 700" style="position:absolute;inset:6%;width:88%;height:88%">
        <g fill="none" stroke="#d9e8ee" stroke-width="5">
          <rect x="100" y="100" width="700" height="500"/>
          <path d="M160 560V210H430V560M430 330H740M580 330V560"/>
          <path d="M160 210L295 120L430 210"/>
          <circle cx="580" cy="235" r="75"/>
        </g>
        <g stroke="#d6a85a" stroke-width="4">
          <path d="M100 620H800M100 605V635M800 605V635"/>
          <path d="M60 100V600M45 100H75M45 600H75"/>
        </g>
        <g fill="#d6a85a" font-family="Arial" font-size="24" font-weight="700">
          <text x="370" y="662">PROPOSED PLAN</text>
          <text x="18" y="370" transform="rotate(-90 18 370)">SITE MEASUREMENTS</text>
        </g>
      </svg>
    </div>`, scene.brief.object);
}

function loftScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,#e8edf0,#cbd6da)">
      <svg viewBox="0 0 900 700" style="position:absolute;inset:4%;width:92%;height:92%">
        <path d="M100 310L450 75L800 310" fill="#222a30" stroke="#071a2d" stroke-width="10"/>
        <path d="M150 300H750V620H150Z" fill="#aa5b43" stroke="#071a2d" stroke-width="9"/>
        <path d="M245 310L450 170L655 310V410H245Z" fill="#f5efe3" stroke="#d6a85a" stroke-width="9"/>
        <g stroke="#071a2d" stroke-width="8">
          <path d="M450 170V410M245 310H655"/>
          <path d="M310 310L450 210L590 310"/>
        </g>
        <rect x="390" y="425" width="120" height="195" fill="#143846" stroke="#f5efe3" stroke-width="9"/>
        <g fill="#d6a85a">
          <circle cx="285" cy="350" r="13"/><circle cx="450" cy="245" r="13"/><circle cx="615" cy="350" r="13"/>
        </g>
        <text x="285" y="145" fill="#071a2d" font-size="31" font-family="Arial" font-weight="800">LOFT STRUCTURE</text>
      </svg>
    </div>`, scene.brief.object);
}

function riskScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:#101820;padding:70px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;height:100%">
        ${["STRUCTURE","FIRE SAFETY","INSULATION","VENTILATION"].map((x,i)=>`
          <div style="position:relative;border:2px solid ${i===1?"#d6a85a":"#ffffff44"};background:${i===1?"#d6a85a":"#172734"};padding:34px;display:flex;align-items:flex-end">
            <span style="position:absolute;top:28px;right:28px;font:800 54px Arial;color:${i===1?"#071a2d":"#d6a85a"}">0${i+1}</span>
            <b style="font:800 30px Arial;color:${i===1?"#071a2d":"white"}">${x}</b>
          </div>`).join("")}
      </div>
    </div>`, scene.brief.object);
}

function costScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:#071a2d;padding:80px">
      <div style="font:900 150px Arial;color:#d6a85a">£</div>
      <div style="position:absolute;left:110px;right:110px;bottom:110px;height:430px;display:flex;align-items:flex-end;gap:38px">
        ${[38,62,78,96].map((h,i)=>`<div style="flex:1;height:${h}%;background:${i===3?"#d6a85a":"#e9e0d0"};box-shadow:12px 12px 0 #0005"></div>`).join("")}
      </div>
      <div style="position:absolute;right:80px;top:90px;font:800 28px Arial;color:white;letter-spacing:.12em">COST EXPOSURE</div>
    </div>`, scene.brief.object);
}

function timelineScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:#f4efe5;padding:95px">
      <div style="position:absolute;left:120px;right:120px;top:48%;height:10px;background:#071a2d"></div>
      ${["CHECK","DESIGN","SUBMIT","APPROVE"].map((x,i)=>`
        <div style="position:absolute;left:${14+i*24}%;top:${40+i%2*12}%;transform:translate(-50%,-50%);text-align:center">
          <div style="width:92px;height:92px;border-radius:50%;background:${i===3?"#d6a85a":"#071a2d"};border:12px solid white;box-shadow:0 0 0 5px #071a2d"></div>
          <b style="display:block;margin-top:22px;font:800 23px Arial;color:#071a2d">${x}</b>
        </div>`).join("")}
    </div>`, scene.brief.object);
}

function complianceScene(scene: PlannedScene) {
  return shell(`
    <div style="position:absolute;inset:0;background:linear-gradient(145deg,#071a2d,#16465a);display:grid;place-items:center">
      <div style="width:540px;height:540px;border-radius:50%;border:24px solid #d6a85a;display:grid;place-items:center;box-shadow:0 0 0 30px #ffffff10">
        <div style="font:900 260px Arial;color:white;line-height:1">✓</div>
      </div>
      <div style="position:absolute;bottom:100px;color:white;font:800 34px Arial;letter-spacing:.18em">TECHNICAL ROUTE VERIFIED</div>
    </div>`, scene.brief.object);
}

export function renderMotionScene(scene: PlannedScene): string {
  switch (scene.motionVisual) {
    case "planning-drawings":
    case "property-survey":
      return planningScene(scene);
    case "cost-analysis":
      return costScene(scene);
    case "project-timeline":
      return timelineScene(scene);
    case "compliance-check":
      return complianceScene(scene);
    case "structural-damage":
    case "foundation-detail":
    case "soil-movement":
    case "tree-risk":
      return riskScene(scene);
    case "victorian-rear-extension":
    case "victorian-terrace":
      return /loft|roof/i.test(scene.text) ? loftScene(scene) : propertyHero(scene);
    default:
      return /loft|roof/i.test(scene.text) ? loftScene(scene) : propertyHero(scene);
  }
}
