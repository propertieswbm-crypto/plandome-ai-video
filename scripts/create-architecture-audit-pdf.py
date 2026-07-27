from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import textwrap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
PDF = OUT / "ai-video-generation-architectural-audit.pdf"

NAVY = colors.HexColor("#091827")
INK = colors.HexColor("#18212B")
SLATE = colors.HexColor("#5B6875")
MIST = colors.HexColor("#EEF2F4")
PAPER = colors.HexColor("#F9F8F4")
GOLD = colors.HexColor("#D6A85A")
RED = colors.HexColor("#B64B45")
GREEN = colors.HexColor("#31735B")
WHITE = colors.white

font_dir = Path("C:/Windows/Fonts")
if (font_dir / "arial.ttf").exists():
    pdfmetrics.registerFont(TTFont("AuditSans", str(font_dir / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("AuditSansBold", str(font_dir / "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("AuditMono", str(font_dir / "consola.ttf")))
else:
    # Bundled PDF fonts are always available.
    pass

SANS = "AuditSans" if "AuditSans" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
BOLD = "AuditSansBold" if "AuditSansBold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"
MONO = "AuditMono" if "AuditMono" in pdfmetrics.getRegisteredFontNames() else "Courier"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="AuditTitle", fontName=BOLD, fontSize=29, leading=31, textColor=WHITE,
    spaceAfter=8, alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    name="AuditDeck", fontName=SANS, fontSize=12, leading=17, textColor=colors.HexColor("#CAD3DA"),
    spaceAfter=10
))
styles.add(ParagraphStyle(
    name="H1x", fontName=BOLD, fontSize=20, leading=23, textColor=NAVY,
    spaceBefore=4, spaceAfter=10
))
styles.add(ParagraphStyle(
    name="H2x", fontName=BOLD, fontSize=13, leading=16, textColor=NAVY,
    spaceBefore=10, spaceAfter=5
))
styles.add(ParagraphStyle(
    name="Bodyx", fontName=SANS, fontSize=8.8, leading=13, textColor=INK,
    spaceAfter=6
))
styles.add(ParagraphStyle(
    name="Smallx", fontName=SANS, fontSize=7.4, leading=10.5, textColor=SLATE,
    spaceAfter=3
))
styles.add(ParagraphStyle(
    name="Labelx", fontName=BOLD, fontSize=7, leading=9, textColor=GOLD,
    spaceAfter=3
))
styles.add(ParagraphStyle(
    name="Calloutx", fontName=BOLD, fontSize=11, leading=15, textColor=NAVY,
    leftIndent=10, rightIndent=10, spaceBefore=7, spaceAfter=7
))
styles.add(ParagraphStyle(
    name="TableHead", fontName=BOLD, fontSize=7.2, leading=9, textColor=WHITE
))
styles.add(ParagraphStyle(
    name="TableCell", fontName=SANS, fontSize=6.8, leading=9.2, textColor=INK
))
styles.add(ParagraphStyle(
    name="TableCellBold", fontName=BOLD, fontSize=7, leading=9.2, textColor=NAVY
))
styles.add(ParagraphStyle(
    name="MonoSmall", fontName=MONO, fontSize=6.5, leading=9, textColor=INK
))

def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])

def bullet(text):
    return Paragraph("&#8226; " + text, ParagraphStyle(
        name="tmp", parent=styles["Bodyx"], leftIndent=10, firstLineIndent=-7, spaceAfter=3
    ))

def section_title(num, title, kicker=None):
    items = []
    if kicker:
        items.append(p(kicker.upper(), "Labelx"))
    items.append(p(f"{num}. {title}", "H1x"))
    items.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=10))
    return items

def header_footer(c: canvas.Canvas, doc):
    if doc.page == 1:
        return
    w, h = A4
    c.saveState()
    c.setStrokeColor(colors.HexColor("#D9DEE2"))
    c.line(18*mm, h-14*mm, w-18*mm, h-14*mm)
    c.setFont(SANS, 7)
    c.setFillColor(SLATE)
    c.drawString(18*mm, h-10.5*mm, "AI VIDEO GENERATION SYSTEM")
    c.drawRightString(w-18*mm, h-10.5*mm, "ARCHITECTURAL AUDIT")
    c.drawString(18*mm, 10*mm, "Prepared from the checked-in implementation - 27 July 2026")
    c.drawRightString(w-18*mm, 10*mm, f"{doc.page:02d}")
    c.restoreState()

class AuditDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                         topMargin=19*mm, bottomMargin=16*mm)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=header_footer))

def box(title, body, accent=GOLD):
    data = [[p(title.upper(), "Labelx")], [p(body, "Bodyx")]]
    t = Table(data, colWidths=[174*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), MIST),
        ("BOX", (0,0), (-1,-1), 0.7, colors.HexColor("#D7DDE1")),
        ("LINEBEFORE", (0,0), (0,-1), 4, accent),
        ("LEFTPADDING", (0,0), (-1,-1), 11),
        ("RIGHTPADDING", (0,0), (-1,-1), 11),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

def node(text, bg=NAVY, fg=WHITE):
    node_style = ParagraphStyle(
        name=f"Node{str(bg)}{str(fg)}", fontName=BOLD, fontSize=7, leading=9.2,
        textColor=fg, alignment=TA_LEFT
    )
    t = Table([[Paragraph(text, node_style)]], colWidths=[42*mm], rowHeights=[13*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("TEXTCOLOR", (0,0), (-1,-1), fg),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOX", (0,0), (-1,-1), 0.7, bg),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ]))
    return t

def arrow():
    return p("&#8595;", "H2x")

story = []

# Cover
cover = Table([
    [p("SYSTEM ARCHITECTURE / CREATIVE TECHNOLOGY", "Labelx")],
    [Spacer(1, 25*mm)],
    [p("AI Video Generation<br/>Architectural Audit", "AuditTitle")],
    [p("Current-state workflow, competitive benchmark and target architecture", "AuditDeck")],
    [Spacer(1, 18*mm)],
    [p("<b>Scope</b><br/>User input through final render and export<br/><br/>"
       "<b>Assessment</b><br/>18 production stages, dependencies, bottlenecks, duplication, "
       "performance, scalability and missing capabilities", "AuditDeck")],
    [Spacer(1, 35*mm)],
    [p("PREPARED 27 JULY 2026", "Labelx")],
    [p("Read-only audit - no source code modified", "AuditDeck")],
], colWidths=[174*mm], rowHeights=[None]*9)
cover.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), NAVY),
    ("LEFTPADDING", (0,0), (-1,-1), 16*mm),
    ("RIGHTPADDING", (0,0), (-1,-1), 16*mm),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
]))
story.append(cover)
story.append(PageBreak())

story += section_title("01", "Executive assessment", "Audit conclusion")
story.append(p(
    "The current product is a deterministic script-to-ad assembler rather than a complete AI creative "
    "platform. It has valuable production foundations - ElevenLabs timing, deterministic variation, "
    "licensed-media providers, Plandome branding, Hyperframes rendering, FFmpeg validation and offline "
    "fallbacks - but it lacks a shared creative project model connecting story, visual intent, assets, "
    "style, timeline, editor and renderer."
))
story.append(box(
    "Primary diagnosis",
    "The quality issue is not a shortage of effects. It is a coordination problem. Several independent "
    "planning and styling systems make local decisions without one canonical creative brief or timeline. "
    "The renderer can therefore produce a technically valid video whose imagery is irrelevant, whose "
    "style is internally inconsistent, or whose template treatment is inappropriate for the scene.",
    RED
))
story.append(Spacer(1, 7))
for x in [
    "<b>Relevant visuals:</b> keyword matching and fallback generation can pass mechanical validation without semantic relevance.",
    "<b>Remotion:</b> the active production path uses generated Hyperframes HTML and GSAP. Remotion is not an installed runtime dependency.",
    "<b>Creative direction:</b> three overlapping style systems may contradict one another.",
    "<b>Editor:</b> visible scene edits are stored, but only a small preference subset influences later rendering.",
    "<b>Captions:</b> word-level clips inflate the timeline and can force transitions to be disabled.",
    "<b>Operations:</b> file/object-storage job state and queue semantics are not durable enough for production scale.",
]:
    story.append(bullet(x))
story.append(Spacer(1, 6))
story.append(box(
    "Recommended architectural target",
    "One versioned CreativeProject, one art-direction compiler, one multi-track timeline, a typed template "
    "registry, semantic asset intelligence, a non-destructive editor and a durable render workflow."
))

story.append(PageBreak())
story += section_title("02", "Current architecture", "Runtime topology")
diagram = [
    [node("USER SCRIPT<br/>AND SETTINGS")],
    [arrow()],
    [node("NEXT.JS API<br/>JOB JSON", GOLD, NAVY)],
    [arrow()],
    [node("LOCAL WORKER OR<br/>SUPABASE QUEUE")],
    [arrow()],
    [node("SCRIPT SPLIT + VO<br/>REGEX PLANNING", MIST, NAVY)],
    [arrow()],
    [node("3 STYLE ENGINES<br/>ASSET CASCADE", RED, WHITE)],
    [arrow()],
    [node("GENERATED HTML<br/>HYPERFRAMES + GSAP")],
    [arrow()],
    [node("FFMPEG MUX +<br/>MECHANICAL QA", GREEN, WHITE)],
    [arrow()],
    [node("MP4 + HTML<br/>REPORTS", GOLD, NAVY)],
]
dt = Table(diagram, colWidths=[174*mm])
dt.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
story.append(dt)
story.append(Spacer(1, 7))
story.append(p(
    "The main critical path is concentrated in <b>scripts/video-worker.ts</b>. It coordinates narration, "
    "planning, media resolution, style selection, composition generation, rendering, muxing, quality "
    "checks and artifact publication. This creates high coupling and makes partial retries difficult."
))

stage_rows = [
("1", "User input", "Raw script, render mode, avatar flag, optional remote media.", "Validated job JSON.", "Thin Zod contract; duplicated UI/backend splitting; no audience, objective, claims, platform, duration, brand brief, moderation or ownership."),
("2", "Prompt engineering", "Scene text, keyword rules, provider configuration.", "Search strings and provider-specific prompts.", "No central prompt compiler, versions, evaluations, negative constraints or provenance. Query logic is scattered."),
("3", "Story generation", "Submitted script.", "Unchanged narration.", "No hook generation, story arc, benefit sequencing, claim review, duration rewriting or concept alternatives."),
("4", "Storyboard", "Sentence-like script fragments.", "Scene array; post-render HTML storyboard.", "Not a pre-production approval artifact. No thumbnails, shot references, locks, regeneration or continuity notes."),
("5", "Scene planning", "Narration fragments and approximate timing.", "Kinds, headlines, visual briefs and queries.", "Regex-driven; multiple overlapping planners; no canonical scene schema; no narrative or shot continuity."),
("6", "Asset selection", "Queries, scene category, aspect ratio.", "Downloaded or generated image/video plus attribution.", "User media, Drive, cache, Pixabay, Commons, ComfyUI, fallback. Weak semantic ranking; duplicated provider code; no indexed manifest."),
("7", "Style selection", "Seed, history and scene count.", "Palette, fonts, layouts, camera and transitions.", "Creative System, Visual Variety and Design DNA overlap. Randomness outweighs semantic fit; process-local history is ineffective."),
("8", "Template selection", "Style metadata and scene index.", "Feature/layout names.", "Local arrays and CSS adaptations, not actual Remotion templates. Features are assigned regardless of scene relevance."),
("9", "Motion planning", "Scene type, duration, template feature.", "CSS classes and GSAP calls.", "No motion-plan IR; intent is coupled to implementation; captions can suppress transitions."),
("10", "Camera planning", "Seeded scene metadata.", "Pan, zoom and parallax transforms.", "No shot size, angle, screen direction, subject tracking or first/last-frame continuity."),
("11", "Timeline", "Narration alignment or text-length weights.", "Scene timings and per-word clips.", "No canonical multi-track timeline. One object per word causes DOM and render growth; editor timing is not authoritative."),
("12", "Components", "Design recipes and feature labels.", "HTML fragments and classes.", "Weakly typed; many recipes are metadata only; no manifests, capability contracts, previews or component regression tests."),
("13", "Composition", "Scenes, assets, styles, captions and logo.", "Large generated HTML document.", "No active Remotion composition. Output strings are difficult to maintain and do not represent an editable project."),
("14", "Animation", "Feature classes and timings.", "GSAP/CSS browser timeline.", "String-generated animation; multiple libraries; no typed keyframes or easing tokens; poor component isolation."),
("15", "Audio", "Script and provider credentials.", "Narration, duration and character alignment.", "ElevenLabs is useful, but music, SFX, ducking, mastering, pronunciation, stems and localisation are missing."),
("16", "Subtitles", "Script and word alignment.", "Animated burned-in captions.", "Overly granular word treatment; no SRT/VTT, transcript editor, reading-speed checks, OCR safety or multilingual tracks."),
("17", "Rendering", "HTML composition, assets and narration.", "H.264/AAC MP4 and QA reports.", "Detached processes and object-storage queue; no lease, checkpoint, cancellation, robust retry or distributed scene rendering."),
("18", "Export", "Rendered media and metadata.", "MP4, inspector, attribution and HTML storyboard.", "No range streaming, variants, editable interchange, native Canva project, captions/stems, publishing or version history."),
]

story.append(PageBreak())
story += section_title("03", "The 18-stage workflow", "Current state, flow and risks")
story.append(p(
    "Each row records what currently happens, the information entering and leaving the stage, and the "
    "most important architectural limitation. Dependencies, performance and scaling effects are expanded "
    "in the following sections."
))

for idx in range(0, len(stage_rows), 6):
    chunk = stage_rows[idx:idx+6]
    data = [[p("#", "TableHead"), p("Stage", "TableHead"), p("Input", "TableHead"),
             p("Output", "TableHead"), p("Current limitations", "TableHead")]]
    for n, name, inp, out, issue in chunk:
        data.append([p(n, "TableCellBold"), p(name, "TableCellBold"), p(inp, "TableCell"),
                     p(out, "TableCell"), p(issue, "TableCell")])
    t = Table(data, colWidths=[8*mm, 24*mm, 37*mm, 36*mm, 69*mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, PAPER]),
        ("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#CED5DA")),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ]))
    story.append(t)
    if idx + 6 < len(stage_rows):
        story.append(PageBreak())
        story += section_title("03", "The 18-stage workflow - continued")

story.append(PageBreak())
story += section_title("04", "Dependencies and operational risks", "Cross-cutting findings")
story.append(p("The pipeline depends on four distinct execution layers:"))
for x in [
    "<b>Application:</b> Next.js, React, API routes and Zod contracts.",
    "<b>Creative/runtime:</b> local TypeScript planners, HTML composition, GSAP, SplitType, Motion and Hyperframes.",
    "<b>Media:</b> ElevenLabs, HeyGen, Pixabay, Wikimedia Commons, Google Drive assets, optional ComfyUI and FFmpeg.",
    "<b>Persistence:</b> local JSON/filesystem or Supabase Storage objects.",
]:
    story.append(bullet(x))
story.append(p("The most consequential operational risks are:"))
for x in [
    "<b>Job loss:</b> the remote daemon removes a queue object before work has completed.",
    "<b>No idempotency:</b> a retry can repeat expensive provider and rendering work.",
    "<b>No checkpointing:</b> late failures can force an almost complete rerun.",
    "<b>No multi-tenancy boundary:</b> job routes do not establish robust user/workspace ownership.",
    "<b>No indexed asset cache:</b> reuse and history rely on scanning directories and JSON files.",
    "<b>No provider control plane:</b> rate limits, costs, latency and health are not centrally managed.",
]:
    story.append(bullet(x))

story.append(p("Duplicate logic", "H2x"))
dup_data = [
    [p("Area","TableHead"), p("Current duplicates","TableHead"), p("Recommended owner","TableHead")],
    [p("Creative direction","TableCellBold"), p("Creative System, Visual Variety, Design DNA","TableCell"), p("ArtDirectionEngine","TableCell")],
    [p("Scene intelligence","TableCellBold"), p("Script scenes, universal planner, premium planners","TableCell"), p("StoryboardPlanner","TableCell")],
    [p("Asset retrieval","TableCellBold"), p("Provider modules plus legacy direct Commons searches","TableCell"), p("AssetProvider adapters","TableCell")],
    [p("Composition","TableCellBold"), p("Premium, legacy and scene-renderer variants","TableCell"), p("Renderer registry","TableCell")],
    [p("Persistence","TableCellBold"), p("Local JSON, Storage objects, unused DB migration","TableCell"), p("Project and Job repositories","TableCell")],
]
t = Table(dup_data, colWidths=[38*mm, 78*mm, 58*mm])
t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),NAVY),("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PAPER]),
    ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#CED5DA")),("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
    ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)
]))
story.append(t)

story.append(PageBreak())
story += section_title("05", "Performance and scalability", "Critical path")
perf = [
("Sequential media work", "Search, download and image-to-video conversion sit in the job critical path.", "Parallel bounded asset tasks, provider rate limits and scene caches."),
("Large inline composition", "One generated HTML file embeds extensive CSS, markup and timelines.", "Typed components and a renderer-independent project/timeline model."),
("Caption density", "Timeline and DOM complexity grow with every spoken word.", "Phrase-level caption clips with active-word spans."),
("Repeated rendering", "A late failure reruns expensive completed stages.", "Stage checkpoints and content-addressed outputs."),
("Filesystem scans", "Audio reuse and creative history scale with total job count.", "Indexed metadata and content hashes."),
("Single-job worker model", "Detached local processes and a simple daemon provide weak back-pressure.", "Durable workflow engine, leases, concurrency pools and cancellation."),
]
for title, current, target in perf:
    story.append(KeepTogether([
        p(title, "H2x"),
        p(f"<b>Current:</b> {current}<br/><b>Target:</b> {target}", "Bodyx")
    ]))

story.append(PageBreak())
story += section_title("06", "Competitive benchmark", "Modern AI creative platforms")
bench = [
("Idea-to-script", "Missing", "InVideo generates scripts, visuals, voiceover, subtitles and music from an idea."),
("Semantic auto-edit", "Keyword heuristics", "Canva assembles footage with smart cuts, synced audio, transitions and story-aware layouts."),
("Conversational editing", "Missing", "Captions and Adobe support natural-language changes and focused edits."),
("Editable design canvas", "Basic scene form", "Canva and Adobe expose layers, assets, captions and manual adjustment."),
("Camera control", "Pan/zoom presets", "Adobe, Veo, Pika and generative-video systems expose shot and camera controls."),
("Reference consistency", "Missing", "Runway, Veo and Kling use references for characters, products, objects and locations."),
("Multi-shot continuity", "Missing", "Kling and Veo provide multi-shot or first/last-frame continuity controls."),
("Audio direction", "Narration only", "InVideo and Captions add music, SFX, cleanup and automatic mixing."),
("Localisation", "Missing", "Captions provides translation, dubbing, voice continuity and lip sync."),
("Template ecosystem", "Local arrays/CSS", "Canva, Adobe and professional editors expose real editable components and templates."),
]
data = [[p("Capability","TableHead"),p("Current system","TableHead"),p("Market direction","TableHead")]]
for row in bench:
    data.append([p(row[0],"TableCellBold"),p(row[1],"TableCell"),p(row[2],"TableCell")])
t = Table(data, colWidths=[42*mm, 38*mm, 94*mm], repeatRows=1)
t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),NAVY),("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PAPER]),
    ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#CED5DA")),("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
    ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)
]))
story.append(t)
story.append(Spacer(1, 8))
story.append(box(
    "Strategic interpretation",
    "The product does not need to recreate every frontier video model. It needs a provider-neutral creative "
    "architecture capable of routing selected shots to stock, internal assets, ComfyUI, Veo, Runway, Kling "
    "or Pika while retaining narrative, brand, timeline and editorial control."
))

story.append(PageBreak())
story += section_title("07", "Missing quality subsystems", "Capability gaps")
missing = [
("Canonical CreativeProject", "Versioned brief, story, scenes, assets, design tokens, timeline, audio, captions, provenance and exports."),
("Brief interpreter", "Audience, objective, offer, tone, platform, duration, claims, brand constraints and CTA."),
("Story and script engine", "Hooks, arcs, alternatives, claim review, pacing and approval."),
("Semantic storyboard", "Shot planning, references, continuity, lock/regenerate and pre-render approval."),
("Multimodal asset intelligence", "Embeddings, VLM reranking, duplicate detection, product/logo recognition and licence tracking."),
("Art-direction compiler", "One design language compiled into tokens, components, motion, camera, captions and transitions."),
("Provider router", "Capability, quality, price, latency, quota and safety-aware model selection."),
("Continuity manager", "Products, characters, locations, palette, wardrobe, geometry and first/last frames."),
("Canonical timeline", "Video, VO, music, SFX, captions, overlays, keyframes and transitions."),
("Template registry", "Versioned components with manifests, previews, constraints and asset requirements."),
("Non-destructive editor", "Canvas, layers, tracks, trim, split, keyframes, asset replacement, history and prompt edits."),
("Audio director", "VO, music, SFX, ducking, mastering, pronunciation, stems and localisation."),
("Multimodal quality evaluator", "OCR, relevance, safe zones, product prominence, brand compliance, continuity and aesthetics."),
("Durable orchestration", "Retries, leases, checkpoints, cancellation, fan-out, observability and cost."),
("Creative learning", "Project revisions, explicit preferences, approvals, A/B variants and campaign-performance feedback."),
]
for i in range(0, len(missing), 2):
    row = []
    for title, body in missing[i:i+2]:
        row.append(Table([[p(title,"H2x")],[p(body,"Smallx")]], colWidths=[83*mm],
                         style=TableStyle([("BACKGROUND",(0,0),(-1,-1),PAPER),
                                           ("BOX",(0,0),(-1,-1),0.5,colors.HexColor("#D8DEE2")),
                                           ("LEFTPADDING",(0,0),(-1,-1),8),
                                           ("RIGHTPADDING",(0,0),(-1,-1),8),
                                           ("TOPPADDING",(0,0),(-1,-1),4),
                                           ("BOTTOMPADDING",(0,0),(-1,-1),4)])))
    if len(row) == 1:
        row.append("")
    table = Table([row], colWidths=[87*mm,87*mm], hAlign="LEFT")
    table.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),
                               ("RIGHTPADDING",(0,0),(-1,-1),4),("TOPPADDING",(0,0),(-1,-1),3),
                               ("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    story.append(table)

story.append(PageBreak())
story += section_title("08", "Ideal architecture", "Target state")
ideal = [
    [node("STRUCTURED BRIEF", GOLD, NAVY), "", node("STORY + SCRIPT<br/>ENGINE")],
    ["", arrow(), ""],
    [node("STORYBOARD +<br/>SHOT PLANNER", MIST, NAVY), "", node("USER APPROVAL<br/>LOCK / REGENERATE", MIST, NAVY)],
    ["", arrow(), ""],
    ["", node("VERSIONED<br/>CREATIVEPROJECT", RED, WHITE), ""],
    [arrow(), arrow(), arrow()],
    [node("ART-DIRECTION<br/>COMPILER"), node("ASSET + MODEL<br/>ROUTER"), node("AUDIO<br/>DIRECTOR")],
    [arrow(), arrow(), arrow()],
    ["", node("CANONICAL<br/>MULTI-TRACK TIMELINE", GOLD, NAVY), ""],
    ["", arrow(), ""],
    [node("VISUAL EDITOR", MIST, NAVY), "", node("PROXY PREVIEW", MIST, NAVY)],
    ["", arrow(), ""],
    ["", node("DURABLE RENDER<br/>ORCHESTRATOR"), ""],
    ["", arrow(), ""],
    [node("SCENE WORKERS"), node("MULTIMODAL QA", GREEN, WHITE), node("EXPORT +<br/>PUBLISHING")],
]
it = Table(ideal, colWidths=[56*mm, 56*mm, 56*mm])
it.setStyle(TableStyle([
    ("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("SPAN",(1,4),(1,4)),("SPAN",(1,8),(1,8)),("SPAN",(1,12),(1,12))
]))
story.append(it)

story.append(PageBreak())
story += section_title("09", "Prioritised improvements", "Delivery roadmap")
priorities = {
"HIGH - architectural foundations":[
"Introduce the versioned CreativeProject intermediate representation.",
"Unify all style systems under one art-direction compiler.",
"Make editor operations mutate the canonical project and drive regeneration.",
"Add multimodal semantic asset ranking and visual relevance QA.",
"Implement a durable queue with leases, retries, idempotency and checkpoints.",
"Split video-worker.ts into separately testable workflow stages.",
"Create a canonical multi-track timeline.",
"Move from per-word clips to phrase captions with active-word spans.",
"Add music, SFX, ducking, loudness and audio-quality control.",
"Add authentication, ownership and project access control.",
"Integrate real Remotion components or correct the product description."
],
"MEDIUM - creative capability":[
"Story and hook generation with approval.",
"Storyboard review, scene locking and targeted regeneration.",
"Reference-conditioned media and cross-shot continuity.",
"Template manifests, capability rules and preview catalogue.",
"Scene-level cache, resumable rendering and aspect-ratio fan-out.",
"SRT/VTT, localisation, dubbing and conversational editing.",
"Golden-render and visual-regression testing.",
"Asset provenance, licensing and provider cost routing."
],
"LOW - expansion after foundations":[
"Additional decorative systems and transition packs.",
"More fallback illustration variants.",
"Advanced collaboration, comments and approvals.",
"Publishing connectors and campaign-performance optimisation."
]
}
for title, items in priorities.items():
    accent = RED if title.startswith("HIGH") else GOLD if title.startswith("MEDIUM") else GREEN
    story.append(box(title, "<br/>".join([f"&#8226; {x}" for x in items]), accent))
    story.append(Spacer(1, 6))

story.append(PageBreak())
story += section_title("10", "Separation, consolidation and modularity", "Boundaries")
sep = [
"API request handling / workflow orchestration",
"Story generation / scene planning",
"Scene planning / asset resolution",
"Asset search / download and transcoding",
"Style selection / style rendering",
"Motion intent / renderer implementation",
"Timeline compilation / composition rendering",
"Narration generation / audio mixing",
"Quality assessment / rendering",
"Export creation / workflow execution",
"Persistence interface / local or remote backend",
"Editor UI / project mutation commands",
]
merge = [
"Style engines -> ArtDirectionEngine",
"Scene planners -> StoryboardPlanner",
"Stock searches -> AssetProvider adapters",
"Renderer variants -> Renderer registry",
"UI/backend segmentation -> ScriptSegmenter",
"Job stores -> JobRepository",
"Design recipes + components -> Template registry",
"Feedback + scene edits -> Project revisions",
"History + learning -> CreativeMemory service",
]
data = [
    [p("SEPARATE","TableHead"),p("MERGE","TableHead")],
    [p("<br/>".join("&#8226; "+x for x in sep),"TableCell"),
     p("<br/>".join("&#8226; "+x for x in merge),"TableCell")]
]
t = Table(data, colWidths=[87*mm,87*mm])
t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),NAVY),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#CED5DA")),
    ("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),8),
    ("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),8),
    ("BOTTOMPADDING",(0,0),(-1,-1),8)
]))
story.append(t)

story.append(PageBreak())
story += section_title("11", "Suggested project structure", "Modular target")
tree = """apps/
  studio/
    app/  editor/  generator/
packages/
  domain/
    creative-project/  brief/  story/  storyboard/
    timeline/  assets/  audio/  captions/  exports/
  creative-engine/
    brief-interpreter/  script-agent/  storyboard-planner/
    art-direction/  motion-planner/  camera-planner/
    quality-evaluator/
  templates/
    registry/  editorial/  paper/  tech/  documentary/
    product-showcase/
  renderers/
    core/  remotion/  hyperframes/  ffmpeg/  preview/
  providers/
    stock/  generative/  speech/  avatar/
  orchestration/
    jobs/  workflows/  workers/  retries/  events/
  persistence/
    projects/  jobs/  assets/  provenance/  revisions/
  observability/
    logging/  tracing/  metrics/  cost/
  test-kits/
    golden-projects/  visual-regression/
    provider-contracts/  render-fixtures/"""
tree_table = Table([[p(tree.replace("\n","<br/>").replace("  ","&nbsp;&nbsp;"),"MonoSmall")]], colWidths=[174*mm])
tree_table.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F0F2F3")),
    ("BOX",(0,0),(-1,-1),0.7,colors.HexColor("#CED5DA")),
    ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
    ("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10),
]))
story.append(tree_table)

story.append(PageBreak())
story += section_title("12", "Future-proof architecture", "Design principles")
future = [
"Treat the CreativeProject - not generated HTML - as the source of truth.",
"Keep rendering engines replaceable behind a common timeline contract.",
"Represent every provider as an adapter with capabilities, cost, latency and safety limits.",
"Store prompts, model versions, seeds, references, asset licences and transformations as provenance.",
"Version templates independently from saved projects.",
"Use scene-level content hashes so unchanged shots are never regenerated.",
"Separate low-latency proxy previews from final rendering.",
"Make quality failures trigger targeted repairs instead of whole-job restarts.",
"Use event-driven workflows with durable checkpoints and idempotent stages.",
"Create golden scripts and visual-reference tests before adding template volume.",
"Learn from explicit edits and approved versions, scoped by user, brand and campaign.",
"Compile multiple aspect ratios and languages from the same canonical timeline.",
"Maintain a capability matrix so the UI only promises features the active runtime truly supports.",
]
for x in future:
    story.append(bullet(x))
story.append(Spacer(1, 8))
story.append(box(
    "Final recommendation",
    "Build toward one canonical creative project, one art-direction system, one timeline, real editable "
    "components, semantic assets and a durable render workflow. Additional effects should follow these "
    "foundations, not precede them.",
    GOLD
))

story.append(PageBreak())
story += section_title("13", "Sources and implementation evidence", "Reference")
sources = [
("Repository implementation", "scripts/video-worker.ts; scripts/premium-visual-composition.ts; scripts/premium-visual-orchestrator.ts; scripts/premium-visual-variety.ts; scripts/design-dna.ts; apps/web/lib/video/creative-system.ts; apps/web/app/(app)/video-editor/video-editor.tsx."),
("Canva", "https://www.canva.com/newsroom/news/canva-video/"),
("Adobe Express", "https://helpx.adobe.com/express/web/video-creation-and-editing/create-videos/generate-videos.html"),
("Adobe AI Assistant", "https://helpx.adobe.com/express/web/ai-assistant/adobe-express-ai-assistant-overview.html"),
("InVideo AI", "https://invideo.io/make/ai-video-generator/"),
("Captions AI Edit", "https://captions.ai/features/edit-with-ai"),
("Captions dubbing", "https://captions.ai/features/ai-dubbing"),
("Runway Gen-4", "https://runwayml.com/research/introducing-runway-gen-4"),
("Google Veo", "https://deepmind.google/models/veo/"),
("Pika", "https://pika.art/faq"),
("Kling", "https://app.klingai.com/cn/quickstart/klingai-video-3-model-user-guide"),
]
for title, url in sources:
    story.append(p(f"<b>{title}</b><br/><font color='#5B6875'>{url}</font>", "Bodyx"))
story.append(Spacer(1, 10))
story.append(p(
    "Assessment scope: checked-in repository implementation and publicly documented platform capabilities "
    "available at the time of review. Product comparisons describe architectural capabilities, not a "
    "claim of feature-for-feature equivalence.",
    "Smallx"
))

doc = AuditDoc(str(PDF))
doc.build(story)
print(PDF)
