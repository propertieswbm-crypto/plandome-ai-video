import { randomUUID } from "node:crypto";
import { createVideoJob } from "../apps/web/lib/video/job-store";
import { createVariationIdentity } from "../apps/web/lib/video/creative-system";

async function main() {
const id = randomUUID();
await createVideoJob(id, {
  script: [
    "Your home already holds more potential than you think.",
    "Plandome studies the property, the street and the planning constraints before you commit.",
    "We turn complex drawings and structural questions into one clear route forward.",
    "See the space, understand the cost and remove the hidden risks.",
    "Every recommendation is matched to your actual UK property.",
    "Start with clarity. Book your Plandome planning review today.",
  ].join(" "),
  format: "portrait",
  quality: "preview",
  useAvatar: false,
  sceneMediaUrls: [],
}, createVariationIdentity("plandome-remotion-feature-sample"));

process.stdout.write(id);
}

void main();
