# Video generation quality gate

This policy is enforced by the worker before an MP4 can be exported.

1. The submitted script is the source of truth. Every narration beat receives a typed visual brief covering topic, object, country, architecture, environment, industry, emotion, action, camera angle and movement.
2. Property and planning searches must explicitly target authentic United Kingdom environments and British architecture. American context is rejected.
3. Visuals resolve in this order: job uploads, the Plandome asset library, licensed provider assets, free licensed stock, then AI generation only when no accurate real asset exists. A provider may be skipped only when it is not configured in the application runtime.
4. A content scene cannot render without line-matched media. Missing media is retried per scene; the entire export is blocked if that scene still fails.
5. Visual assets cannot repeat within one video. Images must use a recorded reusable licence and be at least 1600 pixels on their longest edge.
6. The last template is persisted and cannot be selected for the next video. Brand identity remains consistent while composition, palette and motion vary.
7. Headlines are limited to eight words. Captions and logo remain inside the portrait safe area.
8. Every still receives deliberate camera movement. Content scenes normally follow a 2–4 second rhythm and topic changes create immediate scene changes.
9. The worker writes `scene-briefs.json`, `visual-attributions.json` and `quality-report.json` beside every job for auditability.
10. Export is permitted only when every scene passes. Quality failures never silently fall back to unrelated generic footage.
