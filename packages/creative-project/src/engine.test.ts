import { describe, expect, it } from "vitest";
import { createCreativeProject, mutateProject, phraseCaptions } from "./engine";

describe("CreativeProject", () => {
  it("creates one coherent project with varied camera plans and timeline tracks", () => {
    const project = createCreativeProject({
      id:"creative-1",jobId:"job-1",projectId:"plandome",script:"A loft conversion can unlock space. But planning errors cost time. Review the route before you build. Book a Plandome assessment.",
      segments:["A loft conversion can unlock space.","But planning errors cost time.","Review the route before you build.","Book a Plandome assessment."],
      durationSeconds:20,format:"portrait",quality:"preview",seed:"test-seed",
    });
    expect(project.brief.propertyType).toContain("loft");
    expect(project.story.narrativeArc[0]).toBe("hook");
    expect(project.story.narrativeArc.at(-1)).toBe("cta");
    expect(new Set(project.scenes.map((scene)=>scene.camera.shotSize)).size).toBeGreaterThan(2);
    expect(project.timeline.some((clip)=>clip.track==="music")).toBe(true);
    expect(project.templates.every((template)=>template.capabilities.safeZones.bottom>0)).toBe(true);
  });

  it("uses phrase captions instead of one clip for every word", () => {
    const project = createCreativeProject({id:"c",jobId:"j",projectId:"p",script:"One two three four five six seven eight.",segments:["One two three four five six seven eight."],durationSeconds:8,format:"portrait",quality:"preview",seed:"s"});
    const captions = phraseCaptions(project, "One two three four five six seven eight".split(" ").map((text,index)=>({text,start:index,end:index+.8})));
    expect(captions).toHaveLength(2);
    expect(captions[0]?.words).toHaveLength(6);
  });

  it("records non-destructive scene revisions", () => {
    const project = createCreativeProject({id:"c",jobId:"j",projectId:"p",script:"First. Act now.",segments:["First.","Act now."],durationSeconds:6,format:"portrait",quality:"preview",seed:"s"});
    mutateProject(project,{actor:"user",action:"lock-scene",sceneId:"scene-01",changes:{locked:true}});
    expect(project.version).toBe(2);
    expect(project.scenes[0]?.locked).toBe(true);
    expect(project.history.at(-1)?.action).toBe("lock-scene");
  });
});
