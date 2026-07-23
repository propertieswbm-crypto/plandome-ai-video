import { planVisualScenes } from "./universal-visual-planner";
import {
  upgradeAllScenesForPremiumAd,
  validatePremiumScene,
  selectNoErrorFallback,
  PREMIUM_REALISM_POLICY
} from "./premium-visual-policy";

const scripts = [
  "Thinking of converting your garage? Check the planning and Building Regulations route before construction begins.",
  "Installing a commercial kitchen extraction system? Review noise, odour and the council-approved flue route first.",
  "Increase business efficiency with a modern automated software platform and clearer operational reporting.",
  "Understand investment cost, likely value and project risk before committing capital."
];

for (const script of scripts) {
  const planned = planVisualScenes(script);
  const upgraded = upgradeAllScenesForPremiumAd(planned);

  for (const scene of upgraded) {
    const result = validatePremiumScene(scene);

    if (result.score < PREMIUM_REALISM_POLICY.minimumScore) {
      throw new Error(
        `${scene.sceneId} failed premium validation with score ${result.score}: ${result.reasons.join("; ")}`
      );
    }

    if (
      scene.visualPrompt.toLowerCase().includes("cartoon") &&
      !scene.negativePrompt.toLowerCase().includes("cartoon")
    ) {
      throw new Error(`${scene.sceneId} contains positive cartoon language.`);
    }
  }
}

const fallback = selectNoErrorFallback(
  planVisualScenes("A professional service assessment.")[0],
  "assets/visual-library/videos/professional-service/default.mp4"
);

if (!fallback.allowRender || fallback.mode !== "local_video") {
  throw new Error("Realistic fallback selection failed.");
}

console.log("Premium visual policy tests passed.");
