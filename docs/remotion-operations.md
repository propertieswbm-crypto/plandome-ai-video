# Remotion operations

Hyperframes remains the safe default. The official Remotion packages are pinned
to one exact version in `packages/renderers/remotion/package.json`.

## Requests

- One video: send `renderer: "remotion"` and optionally `variationSeed`.
- Multiple variants: use the batch contract with `numberOfVariants`, `baseSeed`
  and `minimumVariationDistance`.
- Reproduce a render: reuse the CreativeProject version and persisted
  `rendering.variation.seed`.
- Lock direction: provide `visualFamily`; restrict selection with
  `allowedTemplates` or `excludedTemplates`.
- Disable fallback: set `allowRendererFallback: false`. Until Remotion passes
  validation this returns a renderer-unavailable error.

Rendered job files remain under `.data/video-jobs/<job-id>/output.mp4`.

## Hostinger installation and validation

```sh
git pull origin main
corepack enable
pnpm install --frozen-lockfile
export FFPROBE_PATH=/usr/bin/ffprobe
pnpm --filter @openvideo/remotion-renderer typecheck
pnpm --filter @openvideo/remotion-renderer test
pnpm --filter @openvideo/remotion-renderer render:golden
for f in .data/remotion-validation/*.mp4; do ffprobe -v error -show_streams -show_format "$f"; done
```

Only after all five files pass:

```sh
export VIDEO_RENDERER=remotion
export REMOTION_VALIDATED=true
docker compose -f docker-compose.worker.yml up -d --build --remove-orphans
```

Keep `VIDEO_RENDERER=hyperframes` and omit `REMOTION_VALIDATED` for the current
production-safe configuration.
