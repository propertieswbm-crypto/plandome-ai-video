# Cost-Optimization Architecture Addendum

Status: approved direction from the owner on 2026-07-17. This addendum supersedes conflicting infrastructure and billing defaults in architecture blueprint 1.0.

## Decisions

| Capability | Selected implementation | Reason |
|---|---|---|
| Web application | Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui | Requested open-source application stack; portable across Node-compatible hosts. |
| Identity/database | Supabase Free: Auth + PostgreSQL + RLS | One free managed control plane reduces operational burden while retaining standard Postgres. |
| Media storage | `ObjectStorage` port with Cloudinary Free adapter first; local filesystem adapter for development | No mandatory storage bill and no provider lock-in. Assets can move to any S3-compatible service later without changing domain code. |
| Queue | BullMQ with Redis | Open source, durable retries, delayed jobs, concurrency limits, progress, cancellation, and observable queue state. |
| Redis | Local/self-hosted Redis-compatible container | Avoids another paid SaaS. A managed Redis service is optional only if operations later justify it. |
| Rendering | Self-hosted Docker worker with Remotion + FFmpeg | Avoids per-render cloud orchestration fees and supports commodity VPS/on-prem compute. Worker can scale horizontally. |
| AI | Existing OpenAI subscription/API account | Uses the owner's existing paid provider; structured outputs are validated and usage is metered. |
| Narration | Existing ElevenLabs Pro account | Primary text-to-speech provider; audio is cached by content/settings hash to prevent repeat charges. |
| Avatar video | Existing HeyGen Pro account, opt-in per scene/project | Used only where avatar footage materially improves output because it consumes paid quota. |
| Design assets | User uploads, copyright-safe free libraries, existing Canva Pro exports, then AI generation | Reuse and free assets precede paid generation. Canva integration remains import/export based unless its available API supports the required commercial workflow. |
| Billing | Deferred from the first delivery gates | No extra payment provider is introduced until commercial checkout becomes an approved feature. Entitlements remain domain interfaces, not hard-coded vendor logic. |
| Deployment | Docker Compose development/self-host baseline; web remains deployable to any compatible Node host | A reproducible VS Code workflow without requiring a paid platform. |

## Revised runtime topology

```text
Browser
  → Next.js web process
      → Supabase Auth/Postgres
      → Cloudinary-compatible object storage
      → BullMQ producer → Redis
                          ↓
                    render/media worker(s)
                    Remotion + FFmpeg
                          ↓
                  object storage + Postgres status
```

The web process never renders video. It validates and persists commands, creates BullMQ jobs after database commit, and exposes job progress. Workers are idempotent because BullMQ is at-least-once under failure/recovery conditions.

## Reliability change from blueprint 1.0

AWS SQS and the transactional outbox are replaced initially by BullMQ plus a Postgres `job_dispatches` table. Render submission commits the render row and a pending dispatch record together. A dispatcher enqueues deterministic BullMQ job IDs and marks dispatches sent; reconciliation retries unsent records. This preserves the no-lost-job property without paid queue infrastructure.

BullMQ data is operational, not the product system of record. Postgres remains authoritative for user-visible status, attempts, progress checkpoints, and errors. Redis persistence uses AOF, authenticated non-public networking, memory limits, and a `noeviction` policy for queue keys.

## Cost controls built into the product

- Hash-based caching for script analysis, narration, generated assets, proxies, and render manifests.
- User-supplied and reusable library assets are preferred before new generation.
- Scene-level regeneration prevents paying to rebuild an entire project.
- Low-resolution proxy preview; full-quality rendering only on explicit export.
- Configurable render concurrency prevents CPU/RAM overcommit.
- Per-workspace quotas, maximum duration/resolution, provider budgets, and hard request timeouts.
- Usage events capture tokens, characters, seconds, storage bytes, and render CPU time.
- Lifecycle cleanup for abandoned intermediates, while final exports follow user-configured retention.
- HeyGen is opt-in rather than the default visual source.

## Operational tradeoff

Self-hosting Redis and render workers minimizes recurring vendor cost but transfers patching, backups, capacity, monitoring, and incident response to us. The architecture keeps queue and compute behind interfaces so managed infrastructure can be adopted later only when measured operational cost exceeds its price.
