import type { CreativeScene, TemplateDefinition } from "../../creative-project/src/types";
import { templateRegistry as compatibilityTemplates } from "../../creative-project/src/engine";

export class TemplateRegistry {
  private readonly definitions = new Map<string, TemplateDefinition>();
  constructor(definitions: TemplateDefinition[] = compatibilityTemplates) {
    for (const definition of definitions) this.definitions.set(definition.id, definition);
  }
  list() { return [...this.definitions.values()]; }
  get(id: string) { return this.definitions.get(id); }
  require(id: string) {
    const template = this.get(id);
    if (!template) throw new Error(`Template ${id} is not registered.`);
    return template;
  }
  validate(scene: CreativeScene) {
    const template = this.require(scene.templateId);
    return scene.headline.length <= template.capabilities.maxCopyCharacters
      && template.capabilities.supportedCameraMoves.includes(scene.camera.move);
  }
}
