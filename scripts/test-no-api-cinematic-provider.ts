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

if (propertyQueries.length < 4) {
  throw new Error("Property query coverage is too narrow.");
}

if (financeQueries.length < 4) {
  throw new Error("Finance query coverage is too narrow.");
}

if (
  JSON.stringify(propertyQueries) ===
  JSON.stringify(financeQueries)
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
