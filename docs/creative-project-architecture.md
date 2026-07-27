# CreativeProject architecture migration

## Status

This migration introduces `CreativeProject` as the canonical, versioned record
for video planning and editing while preserving the existing Hyperframes
renderer and provider integrations.

The migration is intentionally incremental. Existing `VideoJob` records and
legacy renderer inputs remain supported.

## Stable package boundaries

The incremental migration now exposes `domain`, `creative-engine`, `templates`,
`renderers`, `providers`, `orchestration`, `persistence`, and `test-kits`
packages. Existing entry points remain compatible while delegating new work to
these boundaries. Hyperframes is the available production renderer; Remotion is
registered as renderer-neutral and deliberately unavailable until the real
external template library is installed.

## Measurable pre-render gate

Every enabled scene is scored from 0–100 for semantic relevance, visual
consistency, brand compliance, typography, motion, pacing, asset quality, and
rendering reliability. Production requires an 82 weighted overall score plus
per-dimension floors. Repairable failures receive at most two targeted passes;
critical or unrepaired failures stop before rendering. The worker writes
scene-level evidence to `creative-quality-scorecard.json`.

## Canonical artifact

Every new render writes:

```text
.data/video-jobs/<job-id>/creative-project.json
```

The artifact contains:

- interpreted brief;
- story beats and narrative arc;
- semantic storyboard scenes;
- art direction and design tokens;
- semantic template definitions;
- camera and motion plans;
- asset requirements and selection explanations;
- phrase-caption records;
- audio direction;
- canonical timeline tracks;
- pipeline checkpoints;
- quality findings;
- exports, history, version and approval state.

The project is available through:

```text
GET /api/v1/video-jobs/<job-id>/project
```

## New package

`packages/creative-project` owns the domain and must remain independent of a
specific rendering engine.

### `types.ts`

Defines `CreativeProject` and its brief, story, scenes, timeline, assets,
templates, design tokens, captions, audio, quality, checkpoint, history and
memory contracts.

### `engine.ts`

Provides deterministic brief interpretation, narrative beat assignment,
storyboard planning, semantic template selection, one art-direction compiler,
cinematic camera variation, motion intent, phrase captions, timeline
compilation, plan validation and non-destructive mutations.

### `provider-router.ts`

Defines the provider adapter contract and routes by capabilities, aspect ratio,
health, latency, cost, licensing, quality and semantic reranking. Existing
provider implementations can be migrated behind this interface without
rewriting them.

### `quality-engine.ts`

Defines the multimodal render observation contract and targeted findings for
OCR/safe zones, black frames, duplicate visuals, logos, readability and
composition.

### `repository.ts`

Provides atomic local persistence for CreativeProject and CreativeMemory.

## Active worker migration

`scripts/video-worker.ts` now:

1. generates narration with the existing reliable path;
2. creates one CreativeProject from the script, duration and variation seed;
3. maps canonical camera and storyboard decisions into legacy `PlannedScene`
   fields;
4. records phrase captions and pipeline checkpoints;
5. records selected assets with provider, licence, semantic score and a
   human-readable reason;
6. derives renderer colours, typography, transitions and scene template IDs
   from the canonical art direction;
7. checkpoints rendering, quality and export;
8. exports the final CreativeProject beside the MP4.

## Rendering compatibility

Hyperframes remains the active rendering engine. It was not removed.

The template registry is renderer-neutral and every current registered
template declares `renderer: "hyperframes"`. No `remotion` or `@remotion/*`
runtime package, external `reactvideoeditor/remotion-templates` source, or
Remotion composition exists in this checkout. The former
`remotion-feature-library.ts` file contained local CSS/GSAP feature names, not
third-party Remotion components.

The compatibility feature selector now chooses at most two treatments based on
scene meaning instead of forcing the entire feature catalogue into every
video. Actual Remotion components can be registered later without changing
CreativeProject or the timeline.

## Caption migration

The renderer previously created one Hyperframes clip per spoken word and
disabled transitions when word captions existed.

It now creates one clip per six-word phrase, keeps word timing inside the
phrase record and permits transitions alongside captions. This reduces
timeline and DOM density substantially.

## Editor migration

Editor saves now update `creative-project.json`, increment its version, rebuild
the canonical timeline and append history.

Supported project mutations now include:

- scene copy and duration;
- scene enable/disable;
- scene lock;
- targeted regeneration request;
- semantic template replacement;
- asset URL replacement;
- camera move and shot-size changes.

Legacy edit JSON remains available for backward compatibility.

## Remote-worker migration

The render daemon now keeps the queue object until a render succeeds. It also
uploads the CreativeProject to `projects/<job-id>.json`.

This removes the previous failure window where a job could disappear from the
queue before rendering completed. Full leases and distributed checkpoint
execution remain a future orchestration step.

## CreativeMemory

The domain includes a project-scoped CreativeMemory repository for approved
templates, transitions, typography, pacing and rejected assets. The engine
already considers preferred templates. Approval-driven memory updates should
be added when the product gains an explicit approval action.

## Backward compatibility

- `VideoJob` remains the public job-status contract.
- Existing Hyperframes composition functions remain active.
- Existing asset providers remain active.
- Existing narration and avatar paths remain active.
- Legacy jobs without a CreativeProject still load and accept edit JSON.
- The Canva storyboard export remains unchanged.

## Validation

The migration was validated with:

- TypeScript checks for contracts, observability, creative-project and web;
- 19 passing tests across 5 test files;
- targeted ESLint for all changed TypeScript/TSX modules;
- a successful Next.js production build.

The root repository `tsconfig.json` includes the Next.js application without
its JSX/path configuration and also exposes pre-existing strict errors in
legacy scripts. Package-level TypeScript checks are the authoritative workspace
validation and pass.
