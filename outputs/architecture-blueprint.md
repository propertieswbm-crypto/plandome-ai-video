# AI Video Generation SaaS — Architecture Blueprint

Status: proposed for approval  
Architecture version: 1.0  
Application shape: modular monolith plus asynchronous media workers

## 1. Architectural position

The product starts as a modular monolith, not a collection of microservices. The web application, domain rules, API contracts, and provider adapters live in one TypeScript monorepo. CPU-heavy rendering and durable background work run outside the web request lifecycle.

This gives us one deployable product and one source of truth while retaining explicit module boundaries that can be extracted later. Premature microservices would add distributed transactions, extra deployments, duplicated schemas, and operational overhead before load patterns are known.

### Runtime topology

1. **Vercel / Next.js 16** — UI, React Server Components, authenticated route handlers, webhooks, signed-upload creation, and short orchestration commands.
2. **Supabase** — Postgres, Auth, Realtime, and authorization enforced with Row Level Security (RLS).
3. **S3-compatible object storage** — source uploads, generated images, narration, caption files, intermediate media, render outputs, and thumbnails. The code targets a storage interface; AWS S3 is the production default. CloudFront supplies delivery and signed downloads.
4. **Durable job queue** — AWS SQS with a dead-letter queue. A transactional outbox in Postgres guarantees that committed commands are eventually published.
5. **Workers** — containerized Node.js workers on ECS/Fargate for AI/media preparation and FFmpeg work. Render jobs can use Remotion Lambda for elastic frame rendering; an ECS render implementation remains available for long/custom workloads.
6. **External providers** — OpenAI, ElevenLabs, HeyGen. Each is accessed only through a typed provider port with timeouts, retry classification, usage capture, and provider request IDs.
7. **Observability** — structured logs plus Sentry/OpenTelemetry. Every request and job carries `request_id`, `correlation_id`, `project_id`, and (where applicable) `render_id`.

### Non-negotiable invariants

- The browser never receives provider secrets, the Supabase service-role key, or unrestricted storage credentials.
- A project belongs to exactly one workspace; all tenant-owned rows carry `workspace_id`.
- Every mutation is authorized server-side even when RLS also protects the table.
- Queue delivery is at-least-once, so every handler is idempotent.
- Database rows store object keys and metadata, never expiring signed URLs.
- Published render inputs are immutable snapshots. Editing a project cannot change an in-flight or completed render.
- Monetary and provider usage is recorded from immutable usage events, not reconstructed from mutable project state.

## 2. Repository and folder structure

```text
.
├── apps/
│   ├── web/                         # Next.js 16 application deployed to Vercel
│   │   ├── app/
│   │   │   ├── (marketing)/         # landing, pricing, legal
│   │   │   ├── (auth)/              # sign-in, sign-up, callback, recovery
│   │   │   ├── (app)/               # authenticated product shell
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/
│   │   │   │   ├── editor/[projectId]/
│   │   │   │   ├── ai-studio/
│   │   │   │   ├── brand-kit/
│   │   │   │   ├── settings/
│   │   │   │   ├── billing/
│   │   │   │   ├── api-keys/
│   │   │   │   ├── render-queue/
│   │   │   │   └── downloads/
│   │   │   └── api/v1/              # public and internal HTTP boundary
│   │   ├── components/               # app-specific composition components
│   │   ├── features/                 # project/editor page view models and actions
│   │   ├── instrumentation.ts
│   │   └── proxy.ts                  # auth/session refresh and route gating
│   ├── worker/                       # SQS consumers; no UI dependencies
│   │   └── src/jobs/                 # one idempotent handler per job type
│   └── render/                       # Remotion entry point and compositions
│       ├── src/compositions/
│       ├── src/components/
│       └── src/codecs/
├── packages/
│   ├── contracts/                    # Zod schemas, DTOs, job/event contracts
│   ├── domain/                       # pure entities, policies, state machines
│   ├── application/                  # use cases and provider/storage/queue ports
│   ├── database/                     # generated DB types, repositories, migrations helpers
│   ├── auth/                         # session, workspace authorization, API-key auth
│   ├── providers/                    # OpenAI, ElevenLabs, HeyGen adapters
│   ├── media/                        # ffprobe/FFmpeg plans and media validation
│   ├── storage/                      # S3 adapter, signed operations, object naming
│   ├── queue/                        # SQS adapter, outbox publisher, retry policy
│   ├── observability/                # logger, tracing, error normalization
│   ├── billing/                      # entitlements, credits, Stripe adapter
│   ├── ui/                           # shadcn/ui primitives and shared design system
│   ├── config/                       # validated env and shared tool configuration
│   └── testkit/                      # factories, fixtures, provider fakes
├── supabase/
│   ├── migrations/                   # forward-only SQL migrations
│   ├── seed.sql                      # local/test data only
│   └── tests/                        # pgTAP tests for constraints and RLS
├── infra/                            # AWS queue, bucket, CDN, worker and Remotion IaC
├── tests/
│   ├── e2e/                          # Playwright critical journeys
│   ├── integration/                  # DB/storage/queue/provider-contract tests
│   └── load/                         # queue and API load scenarios
├── tooling/                          # repo scripts; no production runtime code
├── docs/adr/                         # architecture decision records
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Dependency rule

Dependencies point inward:

```text
web / worker / render → application → domain
                           ↑
database / providers / storage / queue implement application ports
```

`domain` imports no framework, database client, SDK, React, or environment variables. Route handlers and job consumers translate transport input to an application command; they do not contain business logic. Cross-package imports use public package entry points, enforced with ESLint boundaries.

Feature folders in `apps/web` own presentation state only. A reusable button belongs in `packages/ui`; a reusable project policy belongs in `packages/domain`; an OpenAI call belongs in `packages/providers`.

## 3. Database design

Postgres is the system of record. All primary keys use UUIDv7 (time-sortable without exposing counts). Timestamps are `timestamptz` in UTC. Prices use integer minor units; media durations use integer milliseconds; frame positions use integers; ratios use numerator/denominator or constrained enums rather than floats.

### Identity and tenancy

| Table | Important columns | Purpose |
|---|---|---|
| `profiles` | `user_id PK/FK auth.users`, `display_name`, `avatar_object_key` | Application profile only; credentials remain in Supabase Auth. |
| `workspaces` | `id`, `name`, `slug`, `created_by` | Tenant and billing boundary. |
| `workspace_members` | `workspace_id`, `user_id`, `role`, `status`, unique pair | Roles: owner, admin, editor, viewer. |
| `workspace_invitations` | `workspace_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at` | Hashed, expiring invitations. |

### Projects and editing model

| Table | Important columns | Purpose |
|---|---|---|
| `projects` | `id`, `workspace_id`, `title`, `status`, `format`, `width`, `height`, `fps`, `brand_kit_id`, `current_revision`, `created_by`, `deleted_at` | Project aggregate root. Status is governed by a state machine. |
| `project_revisions` | `id`, `project_id`, `revision_no`, `snapshot jsonb`, `schema_version`, `created_by` | Immutable editor snapshots for history and render reproducibility. Unique `(project_id, revision_no)`. |
| `scripts` | `id`, `project_id`, `source`, `content`, `language`, `version`, `analysis_status` | Versioned script input; source is pasted/generated/imported. |
| `script_analyses` | `id`, `script_id`, `model`, `prompt_version`, `result jsonb`, `input_tokens`, `output_tokens` | Immutable structured AI result with provenance. |
| `scenes` | `id`, `project_id`, `script_id`, `position`, `title`, `narration_text`, `visual_prompt`, `duration_ms`, `status`, `version` | Editable scene plan. Unique `(project_id, position)`; optimistic concurrency via `version`. |
| `tracks` | `id`, `project_id`, `kind`, `position`, `muted`, `locked` | Video, audio, caption, overlay tracks. |
| `timeline_items` | `id`, `track_id`, `scene_id`, `asset_id`, `item_type`, `start_frame`, `duration_frames`, `trim_*`, `transform jsonb`, `style jsonb`, `version` | Canonical frame-based timeline items. Checks prevent negative bounds. |
| `transitions` | `id`, `project_id`, `from_item_id`, `to_item_id`, `type`, `duration_frames`, `config jsonb` | Explicit transition graph, validated against supported types. |

JSONB is used only where the data is polymorphic and schema-versioned (AI analysis, transforms, styles, snapshots). Searchable relationships, statuses, ownership, costs, and ordering remain relational.

### Media and generated artifacts

| Table | Important columns | Purpose |
|---|---|---|
| `assets` | `id`, `workspace_id`, `project_id nullable`, `kind`, `source`, `object_key`, `mime_type`, `bytes`, `width`, `height`, `duration_ms`, `checksum`, `status`, `metadata jsonb` | Registry for every stored media object. Unique bucket/object key; checksum supports dedupe. |
| `asset_variants` | `id`, `asset_id`, `variant`, `object_key`, dimensions/codec/bytes | Proxies, thumbnails, waveforms, normalized audio. |
| `narrations` | `id`, `scene_id`, `asset_id`, `provider`, `voice_id`, `model`, `text_hash`, `settings jsonb`, `duration_ms` | Generated speech and reproducibility metadata. |
| `caption_sets` | `id`, `project_id`, `source_asset_id`, `language`, `format`, `status` | A caption version for a project/audio source. |
| `caption_cues` | `id`, `caption_set_id`, `position`, `start_ms`, `end_ms`, `text`, `words jsonb`, `speaker` | Editable timed cues; checks enforce `end_ms > start_ms`. |
| `generation_requests` | `id`, `workspace_id`, `project_id`, `scene_id`, `kind`, `provider`, `model`, `prompt`, `settings`, `status`, `idempotency_key`, `provider_request_id` | Auditable image/video/script/analysis generation. |

### Brand, billing, access, and operations

| Table | Important columns | Purpose |
|---|---|---|
| `brand_kits` | `id`, `workspace_id`, `name`, colors/fonts/logo asset references, `is_default` | Workspace visual identity. |
| `voice_presets` | `id`, `workspace_id`, `provider`, `provider_voice_id`, `settings`, `consent_status` | Approved voices; no raw secret credentials. |
| `subscriptions` | `workspace_id`, `provider_customer_id`, `provider_subscription_id`, `plan`, `status`, period dates | Local Stripe subscription projection. |
| `credit_ledger` | `id`, `workspace_id`, `amount`, `reason`, `reference_type/id`, `balance_after` | Append-only credit accounting; unique reference prevents double charging. |
| `usage_events` | `id`, `workspace_id`, `project_id`, `provider`, `metric`, `quantity`, `unit`, `cost_minor`, `occurred_at` | Immutable metering and margin analysis. |
| `api_keys` | `id`, `workspace_id`, `name`, `key_prefix`, `secret_hash`, `scopes`, `last_used_at`, `expires_at`, `revoked_at` | Only an Argon2id hash is stored; plaintext shown once. |
| `webhook_endpoints` | URL, encrypted secret, subscribed events, status | Customer webhook configuration. |
| `webhook_deliveries` | endpoint/event, attempt, status, response code, next attempt | Durable signed webhook delivery. |
| `render_jobs` | `id`, `workspace_id`, `project_id`, `revision_id`, `status`, `progress`, `preset`, output asset, `attempt_count`, lease fields, error code/message, timestamps | Render lifecycle and user-visible queue state. |
| `job_runs` | `id`, `job_type`, `aggregate_type/id`, `idempotency_key`, `status`, attempt/timing/error fields | Generic execution audit. |
| `outbox_events` | `id`, `event_type`, `aggregate_type/id`, `payload`, `available_at`, `published_at`, attempts | Transactional handoff from Postgres to SQS. |
| `audit_logs` | actor, workspace, action, target, IP/user-agent, metadata, timestamp | Append-only security and administrative history. |

### Important indexes and constraints

- Every tenant table: index begins with `workspace_id`; common list indexes include `(workspace_id, created_at desc)`.
- Partial indexes cover active jobs (`status in ('queued','running','retrying')`), unpublished outbox rows, active API keys, and non-deleted projects.
- Unique idempotency keys on generation requests, job runs, render submission, credit references, and webhook provider event IDs.
- Foreign-key delete behavior is explicit: immutable financial/audit records are restricted; edit children cascade only where safe; user-visible deletion is soft followed by retention-policy cleanup.
- State-changing database functions lock the aggregate row and validate allowed transitions.
- No client can update billing, usage, render completion, provider IDs, or audit rows.

### RLS model

RLS is enabled on every exposed tenant table. Policies use indexed membership checks against `workspace_members`. Viewer/editor/admin/owner privileges are separated by operation. Server workers use a dedicated server credential and still pass `workspace_id` into repositories; service-role use is isolated to server-only packages. Storage access uses private buckets and server-issued short-lived signed operations.

RLS is defense in depth, not the only authorization layer. Application use cases also check permissions so denial is consistent across browser sessions, API keys, workers, and future integrations.

## 4. API architecture

### Interfaces

1. **Server Components** perform read-oriented page composition through application queries.
2. **Server Actions** handle UI-only mutations with progressive enhancement. They call the same application use cases as HTTP routes.
3. **`/api/v1` Route Handlers** are the stable public API and integration surface.
4. **Provider webhooks** live under `/api/webhooks/{provider}` and verify signatures against the raw request body before parsing.
5. **Worker messages** use versioned Zod contracts from `packages/contracts`, not HTTP DTOs reused by accident.

### HTTP conventions

- Resource-oriented routes: `/api/v1/projects`, `/projects/{id}/scenes`, `/renders`, `/assets/upload-intents`.
- Commands that are not CRUD are explicit subresources: `/projects/{id}/script-analysis`, `/renders/{id}/cancel`.
- Every write accepts an `Idempotency-Key`; server stores result identity and rejects mismatched reuse.
- Cursor pagination only; no offset pagination for mutable lists.
- Success envelope: `{ data, meta? }`. Error uses RFC 9457 Problem Details with stable `code`, `status`, `detail`, `requestId`, and optional field errors.
- `ETag`/revision or explicit `version` is required for conflicting editor updates; stale writes return `409`.
- Long work returns `202 Accepted` with a job resource and status URL.
- API keys are scoped, rate-limited by workspace/key/IP, and never authorize beyond the associated member/workspace entitlements.
- OpenAPI is generated from the same Zod contracts used at runtime; contract drift fails CI.

### Representative endpoints

```text
POST   /api/v1/projects
GET    /api/v1/projects?cursor=&limit=
GET    /api/v1/projects/{projectId}
PATCH  /api/v1/projects/{projectId}
POST   /api/v1/projects/{projectId}/scripts
POST   /api/v1/projects/{projectId}/script-analysis
PUT    /api/v1/projects/{projectId}/scenes/{sceneId}
POST   /api/v1/projects/{projectId}/narrations
POST   /api/v1/projects/{projectId}/captions
POST   /api/v1/assets/upload-intents
POST   /api/v1/assets/{assetId}/complete
POST   /api/v1/renders
GET    /api/v1/renders/{renderId}
POST   /api/v1/renders/{renderId}/cancel
POST   /api/v1/downloads/{assetId}/sign
```

Upload and download bodies do not proxy through Vercel. The API authorizes an intent and returns a short-lived, size/type-constrained signed operation. Completion verifies object metadata and schedules malware/media probing before an asset becomes usable.

## 5. Video pipeline and queue design

### Job state machine

```text
draft → validating → queued → preparing → rendering → quality_check
      → completed
      → retrying → (previous safe stage)
      → failed
      → cancelled
```

The orchestration graph is persisted. Each stage records input hashes, output asset IDs, progress, attempts, provider IDs, and normalized errors. A stage is skipped only when its exact input hash already has a valid output.

### End-to-end workflow

1. Project creation writes the aggregate and initial revision.
2. Script creation stores a version; analysis calls OpenAI for a strict structured result validated with Zod.
3. Scene planning is a separate command so users can edit/regenerate it without losing the original analysis.
4. Narration generation creates one request per scene, normalizes audio, probes duration, and records provider usage.
5. Visual generation/search/upload produces assets with provenance and moderation status.
6. Caption alignment uses narration timings when available, otherwise transcription/forced alignment; cue edits create a new caption version.
7. Timeline compilation converts scene timing, captions, brand settings, animations, and transitions into a versioned `RenderManifest`.
8. Render submission transactionally freezes a project revision, reserves credits, creates the render job, and writes an outbox event.
9. An outbox publisher sends the job to SQS; duplicate messages resolve to the same idempotent job run.
10. The worker validates all assets, materializes the Remotion bundle/manifest, renders, muxes with FFmpeg where needed, probes the output, generates a thumbnail/proxy, and uploads results.
11. Automated QC checks duration drift, missing/black/frozen frames, audio presence/peaks, caption bounds, output dimensions, codec, and file integrity. Failures are classified as retryable, user-actionable, or terminal.
12. Completion finalizes credits from actual usage, emits Realtime progress/event updates, and makes a signed export available.

### Reliability and scaling

- Separate queues by workload: `ai`, `media`, `render`, and `webhook`, each with independent concurrency, timeouts, and DLQ.
- Visibility timeouts exceed expected stage time and workers extend leases with heartbeats.
- Retries use exponential backoff with jitter and error classification. Invalid input and policy failures do not retry.
- Per-workspace concurrency and monthly entitlements prevent one tenant from consuming the fleet.
- Cancellation is cooperative: workers check the persisted cancellation flag between expensive steps and abort provider/render work where supported.
- A reconciliation job detects stale leases, orphan objects, stuck jobs, unpublished outbox events, and provider callbacks that never arrived.
- Worker autoscaling is driven by queue depth and oldest-message age, not HTTP traffic.

## 6. Remotion/editor contract

The editor and renderer share a versioned, discriminated `RenderManifest` contract; the database schema is not passed directly to Remotion.

```text
RenderManifest
├── schemaVersion, compositionId, width, height, fps, durationInFrames
├── assets[]        # immutable object/version references plus probed metadata
├── tracks[]
│   └── items[]     # typed video/audio/image/caption/text/shape items
├── transitions[]
├── brand           # resolved colors, fonts, logo assets
└── renderSettings  # codec, bitrate/quality, audio, pixel format
```

Manifest compilation is deterministic: identical project revision and preset produce the same manifest hash. Remotion components are pure and do not call APIs at render time. All remote assets are validated and made available before frame rendering. Fonts are pinned assets, not fetched from mutable URLs.

The browser preview uses the same manifest and composition components as production, while low-resolution proxy assets keep interaction responsive. Autosave batches patches, uses optimistic updates, and resolves conflicts with the item `version`/project revision rather than last-write-wins.

## 7. Provider architecture

Application ports define capabilities rather than vendor SDK shapes:

```text
ScriptAnalyzer
TextToSpeechProvider
VisualGenerationProvider
AvatarVideoProvider
CaptionAlignmentProvider
ObjectStorage
JobQueue
UsageMeter
```

Adapters normalize provider results into domain contracts. Each call includes a deterministic idempotency fingerprint where the vendor supports it, an abort timeout, bounded retry policy, usage/cost capture, and redacted logging. Prompts and structured output schemas are versioned. Provider-specific identifiers remain in generation/narration metadata and never leak into core domain types.

This prevents OpenAI, ElevenLabs, or HeyGen model/API changes from spreading through route handlers and UI code, and makes contract tests possible without fake production behavior.

## 8. Security, privacy, and abuse controls

- Supabase Auth uses secure cookie sessions; privileged mutations require recent authentication where appropriate.
- CSRF protection applies to cookie-authenticated state changes; webhook routes rely on signature verification and replay windows.
- CSP, strict transport security, secure cookies, output escaping, upload MIME/magic-byte validation, and SSRF-safe media fetching are mandatory.
- Arbitrary URLs are never handed directly to FFmpeg/Chromium. An ingest worker downloads from an allowlisted/validated resolved address, blocks private/link-local IP ranges, limits size/time, scans, and stores a controlled object.
- Provider keys are server-only environment secrets initially; production rotation moves to a secret manager. Logs redact tokens, prompts marked private, signed URLs, and PII.
- User/API rate limits, generation quotas, content moderation, voice-consent records, and avatar provenance reduce abuse.
- Workspace deletion is an asynchronous, auditable retention workflow. Database backups and object-storage lifecycle/versioning are planned separately because database backups do not include media objects.
- Audit events cover authentication-sensitive actions, membership/role changes, API keys, billing, exports, provider settings, and deletions.

## 9. Error handling, logging, and observability

Errors are a discriminated hierarchy: validation, authentication, authorization, not-found, conflict, quota, provider-rate-limit, provider-unavailable, media-invalid, render-failed, and internal. Only safe messages cross the API boundary; stack traces and raw provider payloads stay in telemetry.

Logs are structured JSON with stable event names and redaction. Traces cross HTTP → outbox → queue → worker → provider/render stages through propagated correlation IDs. Metrics include API latency/error rate, queue depth/age, job success and retry rate, stage duration, render factor (render time/video duration), provider latency/errors, storage bytes, credit reconciliation drift, and gross margin per render.

Alerts are tied to user impact: old queued jobs, render failure ratio, DLQ growth, webhook failure, credit drift, storage errors, and provider degradation. Health endpoints distinguish process health from dependency readiness.

## 10. Testing and delivery gates

- **Unit:** domain policies, timeline math, manifest compiler, state machines, billing arithmetic, error mapping.
- **Database:** migration, constraints, RLS, and database functions using pgTAP against ephemeral Supabase/Postgres.
- **Contract:** provider adapters against recorded/sandbox responses; OpenAPI and queue schema compatibility.
- **Integration:** real Postgres plus local S3/SQS-compatible services, media fixtures, FFmpeg/ffprobe.
- **Visual/render:** deterministic frame snapshots and short golden-video probes across supported aspect ratios.
- **End-to-end:** auth, project/script/scenes, editor save/conflict, render submission/progress/cancel/export, billing limits.
- **Security:** cross-tenant access tests, API-key scopes, webhook replay/signature tests, malicious uploads and SSRF cases.
- **Load:** project lists, concurrent autosaves, outbox throughput, queue backpressure, render fleet scaling.

CI runs typecheck, lint, dependency-boundary rules, unit/database/integration tests, migration checks, secret scan, dependency audit, and production build. Preview environments never share production provider credentials or data. Database changes are expand/migrate/contract and forward-only; deployments remain backward-compatible with queued older job/manifest versions.

## 11. Major decisions and rationale

| Decision | Why | Rejected alternative |
|---|---|---|
| Modular monolith + workers | Keeps product iteration coherent while isolating CPU-heavy work. | Early microservices multiply operational failure modes. |
| pnpm/Turborepo monorepo | Shares strict contracts among web, worker, and render without publishing packages. | Separate repositories invite contract drift. |
| Supabase Postgres + RLS | Strong relational integrity, Auth integration, Realtime progress, tenant defense in depth. | Document-only persistence makes timelines, billing, and authorization harder to constrain. |
| AWS S3/CloudFront behind a port | Durable large-object storage, lifecycle rules, signed access, and proximity to render compute. | Storing media in Postgres or proxying it through Vercel is inefficient and unsafe. |
| SQS + transactional outbox | Durable at-least-once delivery without losing jobs between DB commit and publish. | In-memory/background promises can disappear on serverless termination. |
| ECS workers + optional Remotion Lambda | FFmpeg/Chromium need controlled CPU, memory, binaries, time, and autoscaling. | Rendering inside a Vercel request risks duration/memory/bundle limits. |
| Immutable revision + manifest | Reproducible exports, auditability, safe retries, and old-version compatibility. | Rendering from live mutable rows produces nondeterministic output. |
| Frame-based timeline, ms-based source metadata | Remotion stays frame-accurate while audio/provider data retains natural timing. | Floats accumulate drift and ambiguous rounding. |
| Versioned Zod contracts | Runtime validation and TypeScript inference at every untrusted boundary. | TypeScript types alone vanish at runtime. |
| Direct signed object transfer | Avoids function body limits/cost and supports resumable large uploads. | API proxy uploads create bottlenecks and timeout risk. |

## 12. Incremental delivery plan and approval gates

Each major feature ends with working code, migrations, tests, a production build, and an explicit approval pause.

1. **Foundation and identity** — monorepo, Next.js shell/design system, validated configuration, Supabase local setup, auth, workspace tenancy/RLS, logging/error foundation, CI.
2. **Project management** — dashboard, project CRUD, project settings/formats, revisions, authorization, empty editor shell.
3. **Script and AI scene planning** — script versions/generation, structured analysis, scene generation/editing, prompt/version/usage records.
4. **Asset pipeline and Brand Kit** — direct/resumable uploads, validation/probing, asset library, variants, brand assets/styles.
5. **Narration and captions** — ElevenLabs voices/consent/settings, generation, normalization, alignment, editable cue UI.
6. **Visual generation and HeyGen** — provider workflows, moderation, generated assets, scene selection and regeneration.
7. **Video editor** — tracks/items, autosave/conflicts, Remotion preview, animations, transitions, caption styles, undo/redo.
8. **Queue and rendering** — outbox/SQS, workers, manifest compiler, Remotion/FFmpeg rendering, progress/cancel/retry, automated QC.
9. **Downloads and render operations** — render queue page, output review, signed exports, retention/lifecycle controls.
10. **Billing, plans, and API keys** — Stripe subscription lifecycle, credit reservation/finalization, entitlements, scoped keys, public API/rate limits.
11. **Production hardening and launch** — end-to-end/load/security tests, observability/alerts, backup/restore drill, runbooks, cost controls, accessibility and performance audit.

No later gate is started without approval. Within a gate, schema, application use case, API, UI, observability, and tests ship together so there are no demo-only vertical slices.

## 13. Decisions to lock with this approval

Approval of this blueprint locks these defaults for implementation:

- Multi-tenant workspaces from day one.
- AWS S3 + CloudFront as primary media storage/delivery, accessed through a storage port.
- AWS SQS + DLQ and a Postgres transactional outbox.
- ECS/Fargate media workers; Remotion Lambda for elastic renders with an ECS-compatible render abstraction.
- Stripe for subscription/credit billing.
- pnpm + Turborepo.
- Modular monolith boundaries shown above.

Changing any of these later is possible, but it affects migrations, infrastructure, or core contracts and should be recorded as an ADR.
