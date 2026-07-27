import type { CreativeMemory, CreativeProject, CreativeScene } from "../../creative-project/src/types";
import {
  buildTimeline, compileArtDirection, createCreativeProject, interpretBrief, phraseCaptions,
} from "../../creative-project/src/engine";
import { evaluateRender } from "../../creative-project/src/quality-engine";

export class BriefInterpreter { interpret = interpretBrief; }
export class StoryEngine {
  create(input: Parameters<typeof createCreativeProject>[0]) { return createCreativeProject(input).story; }
}
export class StoryboardPlanner {
  plan(input: Parameters<typeof createCreativeProject>[0]) { return createCreativeProject(input).scenes; }
}
export class ArtDirectionEngine { compile = compileArtDirection; }
export class ScriptSegmenter {
  segment(script: string) {
    return script.split(/(?<=[.!?])\s+|\n+/).map((item)=>item.trim()).filter(Boolean);
  }
}
export class ContinuityManager {
  repair(scenes: CreativeScene[]) {
    const shotSizes: CreativeScene["camera"]["shotSize"][] = ["wide","medium","detail","close","top","low","high"];
    scenes.forEach((scene,index) => {
      const previous = scenes[index-1];
      if (previous?.camera.shotSize === scene.camera.shotSize && !scene.locked) {
        scene.camera.shotSize = shotSizes[(shotSizes.indexOf(scene.camera.shotSize)+1)%shotSizes.length]!;
      }
    });
    return scenes;
  }
}
export class AudioDirector {
  plan(project: CreativeProject) { return project.audio; }
  captions(project: CreativeProject, words: Parameters<typeof phraseCaptions>[1]) { return phraseCaptions(project, words); }
}
export class TimelineCompiler { compile = buildTimeline; }
export class MultimodalQualityEvaluator { evaluateRender = evaluateRender; }
export class CreativeProjectFactory {
  create(input: Parameters<typeof createCreativeProject>[0] & { memory?: CreativeMemory }) { return createCreativeProject(input); }
}
