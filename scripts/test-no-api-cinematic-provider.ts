import {
  buildNoApiQueryTiers,
  cameraPresetForScene
} from "./no-api-cinematic-provider";

const propertyQueries = buildNoApiQueryTiers({
  sceneId: "scene-01",
  sceneIndex: 0,
  totalScenes: 3,
  category: "property_exterior",
  subject: "Victorian terraced house",
  environment: "British residential street",
  action: "planning inspection",
  durationSeconds: 5
});

const financeQueries = buildNoApiQueryTiers({
  sceneId: "scene-02",
  sceneIndex: 1,
  totalScenes: 3,
  category: "finance",
  subject: "quantity surveyor",
  environment: "professional office",
  action: "reviewing construction costs",
  durationSeconds: 5
});

const constructionQueries = buildNoApiQueryTiers({
  sceneId: "scene-03",
  sceneIndex: 2,
  totalScenes: 3,
  category: "construction",
  subject: "site manager",
  environment: "active building site",
  action: "tracking structural progress",
  durationSeconds: 5
});

const planningQueries = buildNoApiQueryTiers({
  sceneId: "scene-04",
  sceneIndex: 3,
  totalScenes: 3,
  category: "planning_documents",
  subject: "planning consultant",
  environment: "architectural studio",
  action: "reviewing council documents",
  durationSeconds: 5
});

const lifestyleQueries = buildNoApiQueryTiers({
  sceneId: "scene-05",
  sceneIndex: 4,
  totalScenes: 3,
  category: "lifestyle",
  subject: "family lifestyle",
  environment: "UK residential street",
  action: "enjoying a quality home",
  durationSeconds: 5
});

if (propertyQueries.length < 4) {
  throw new Error("Property query coverage is too narrow.");
}

if (financeQueries.length < 4) {
  throw new Error("Finance query coverage is too narrow.");
}

if (constructionQueries.length < 4) {
  throw new Error("Construction query coverage is too narrow.");
}

if (planningQueries.length < 4) {
  throw new Error("Planning document query coverage is too narrow.");
}

if (lifestyleQueries.length < 4) {
  throw new Error("Lifestyle query coverage is too narrow.");
}

if (
  JSON.stringify(propertyQueries) ===
  JSON.stringify(financeQueries) ||
  JSON.stringify(financeQueries) ===
  JSON.stringify(constructionQueries) ||
  JSON.stringify(constructionQueries) ===
  JSON.stringify(planningQueries) ||
  JSON.stringify(planningQueries) ===
  JSON.stringify(lifestyleQueries)
) {
  throw new Error(
    "Different categories produced identical media searches."
  );
}

const presets = new Set(
  Array.from(
    {
      length: 6
    },
    (_, index) => cameraPresetForScene(index).name
  )
);

if (presets.size < 6) {
  throw new Error(
    "Camera motion presets are not sufficiently varied."
  );
}

console.log(
  "No-key cinematic media provider tests passed."
);
