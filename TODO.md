# Comprehensive Plan: Pixabay Integration & No-Scene-Failure Visual Pipeline

## Information Gathered

### Architecture
- `universal-visual-planner.ts` — Produces `SceneVisualPlan[]` with 18 categories, subjects, environments, actions
- `no-api-cinematic-provider.ts` — Wikimedia Commons provider with `SearchCache`, `TimeBudget`, concurrent searches (3 max), 45s budget, 10s timeout, 2 retries
- `premium-visual-orchestrator.ts` — 3-phase resolution: Phase 1 (online: no_api → comfyui), Phase 2 (local library), Phase 3 (brand/fallback)
- `video-worker.ts` — orchestrates everything, currently throws if all premium providers fail
- `video-composition.ts` — renders HTML/GSAP composition, currently has Polaroid frames, tilted cards, oversized text
- `docker-compose.worker.yml` — already has single `env_file: [./worker-secrets.env]` ✓
- `.gitignore` — already has `worker-secrets.env` ✓
- `.dockerignore` — already has `worker-secrets.env` ✓

### Current Gaps
1. No Pixabay provider at all
2. `video-worker.ts` throws error when premium providers fail (no true fallback)
3. `video-composition.ts` has Polaroid-style visual frames, oversized text boxes, debug elements
4. Progress messages are not granular enough (stuck at 42%)
5. No test file for Pixabay

## Plan

### 1. `scripts/pixabay-visual-provider.ts` (NEW FILE)
- `PixabayVisualConfig` interface with `enabled`, `apiKey`, `timeoutMs`, `maxRequestsPerScene`, `safeSearch`
- `PixabayMediaItem` metadata type (id, type, pageURL, user, tags, sourceURL, localImagePath, localVideoPath, searchQuery, imageHash, videoHash, cameraPreset)
- `getPixabayConfig()` — reads from environment: `PIXABAY_ENABLED`, `PIXABAY_API_KEY`, `PIXABAY_TIMEOUT_MS`, `PIXABAY_MAX_REQUESTS_PER_SCENE`, `PIXABAY_SAFE_SEARCH`
- `buildPixabayQueries()` — scene-specific UK property/construction searches: loft conversion, drainage, structural, planning documents, fire safety, commercial kitchen, finance (NOT generic Victorian house)
- `searchPixabayMedia()` — API call with safe search, timeout, retry (2 max), prefers videos, accepts photos as fallback
- `convertPhotoToVideo()` — FFmpeg Ken Burns cinematic MP4 from photograph (1080×1920)
- `acceptPixabayResult()` — checks against usedPixabayIds, usedSourceUrls, usedImageHashes, usedVideoHashes
- `verifyMediaUniqueness()` — byte-level hash deduplication (different URLs with identical bytes = duplicate)
- API key never appears in logs, errors, or output

### 2. `scripts/premium-visual-orchestrator.ts` (EDIT)
- Update `ResolvedSceneVisual.source` union to include `"pixabay_video"` and `"pixabay_photo"`
- Add import of Pixabay provider
- Add Pixabay as Phase 1 provider (between Wikimedia and ComfyUI)
- Pixabay failure → continue to next provider (never fail the scene)
- Update `ResolvePremiumVisualOptions` to include `usedPixabayIds` and `usedVideoHashes`

### 3. `scripts/video-worker.ts` (EDIT)
- Import Pixabay related tracking sets
- Update progress messages to granular stages:
  - 8% → "Planning scenes and preparing visual briefs"
  - 20% → "Generating ElevenLabs voiceover"
  - 38% → "Generating standing Ella hook" (if avatar)
  - 42-56% → "Searching visual 1 of N" / "... 2 of N" / "... 3 of N"
  - 57-69% → "Preparing visual 1 of N" / "..."
  - 70-85% → "Rendering scene 1 of N" / "..."
  - 86-97% → "Building final advert" / "Finalising audio"
  - 100% → "Complete"
- **Critical**: Replace the `throw new Error(...)` in the loop with a deterministic fallback that never fails the scene

### 4. `scripts/video-composition.ts` (EDIT)
Major CSS/HTML changes:
- Remove Polaroid-style visual frames (thick white borders with shadow)
- Remove tilted cards
- Remove huge text boxes covering property
- Ensure full-screen real media
- Add proper cinematic overlay on video scenes
- Keep small Plandome logo
- Use Montserrat font
- Navy, white, restrained gold palette
- Short readable headline + secondary caption
- Smooth transitions with no blank first frame
- No black transition frames, no debug text, no scene number
- Add `+44 7835 397683` on final CTA (small, tidy)

### 5. `scripts/test-pixabay-visual-provider.ts` (NEW FILE)
Mocked tests (do not contact real Pixabay API):
1. Pixabay disabled without key
2. API key never in logs/errors
3. Video results preferred over images
4. Images converted to MP4
5. Duplicate Pixabay IDs rejected
6. Duplicate source URLs rejected
7. Duplicate image hashes rejected
8. Duplicate video hashes rejected
9. Safe search params included
10. Requests limited per scene (max 3)
11. Timeouts trigger next provider
12. Rate limits trigger bounded retry
13. Different topics produce different queries
14. Drainage ≠ generic-property queries
15. Commercial-kitchen uses extraction searches
16. Camera presets vary
17. Missing online media reaches deterministic fallback
18. Deterministic fallback produces valid MP4
19. Normal scenes always finish with video
20. CTA scenes can use branded animation
21. Attribution manifests preserve Pixabay metadata
22. worker-secrets.env is gitignored
23. docker-compose.worker.yml has one env_file key
24. video-composition.ts compiles
25. TypeScript validation passes

### 6. `docker-compose.worker.yml` (VERIFY ONLY — NO CHANGE NEEDED)
- Confirm single `env_file: [./worker-secrets.env]`
- Add structural YAML test in test file

### 7. Validation
- `npx tsc ...` with all relevant files
- Run test files
- `git diff --check`

### 8. Commit
- `git add -A && git commit -m "Complete Pixabay multi-source fail-safe visual pipeline" && git push origin main`

## Files to Create
- `scripts/pixabay-visual-provider.ts`
- `scripts/test-pixabay-visual-provider.ts`

## Files to Edit
- `scripts/premium-visual-orchestrator.ts`
- `scripts/video-worker.ts`
- `scripts/video-composition.ts`

## Files to Verify (no changes)
- `.gitignore` ✓ (already has `worker-secrets.env`)
- `.dockerignore` ✓ (already has `worker-secrets.env`)
- `docker-compose.worker.yml` ✓ (already has single `env_file`)

## Follow-up Steps
1. Run TypeScript type-check on all modified/created files
2. Run all visual-pipeline test files
3. Run `git diff --check`
4. Commit and push
