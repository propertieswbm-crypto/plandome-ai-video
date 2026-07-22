# Plandome AI Video Design System

Plandome videos are premium, concise UK property and planning advertisements. Every scene follows the narration and uses authentic British architectural language.

## Brand

- Keep the Plandome logo clear, readable, and inside the safe area throughout the video.
- Primary character: warm cream backgrounds, near-black ink, and a restrained orange accent.
- A rotating secondary palette is allowed so consecutive videos feel distinct, while contrast and brand recognition remain consistent.
- Headlines are short, editorial, and never bulky. Supporting captions follow the spoken line exactly.

## Visual direction

- HyperFrames is the primary visual engine for every scene, from hook to CTA.
- Use user assets or the company gallery only for occasional image-led slides where a real, exact-match asset strengthens the narration.
- Do not search public stock providers during generation. Original HyperFrames motion scenes must make the render deterministic and immune to provider throttling.
- Never substitute American architecture or generic corporate imagery.
- Every scene must visibly identify the object described by its narration.

## Motion

- Use subtle push, pull, pan, parallax, dolly, masked reveal, and editorial wipe patterns.
- Change the composition with the narration, normally every two to four seconds.
- Animate with transform and opacity; keep motion continuous but restrained.
- Rotate layouts and motion patterns between videos without compromising logo placement or readability.
- Apply ad structure deliberately: immediate hook, early branding, one concise message per scene, narration-matched supers, and a direct branded CTA.

## Quality gates

- No missing, repeated, stretched, or blurry visuals.
- No text outside safe areas; maintain WCAG AA contrast.
- A provider timeout or rate limit must not abort a render. Use the matching local motion visual and preserve the provider error only as diagnostics.
