import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreativeMemory, CreativeProject } from "./types";

export class CreativeProjectRepository {
  constructor(private readonly root: string) {}
  private file(jobId: string) { return path.join(this.root, jobId, "creative-project.json"); }
  async load(jobId: string): Promise<CreativeProject | null> {
    try { return JSON.parse(await readFile(this.file(jobId), "utf8")) as CreativeProject; }
    catch { return null; }
  }
  async save(project: CreativeProject) {
    const file = this.file(project.jobId);
    const temp = `${file}.${process.pid}.tmp`;
    await mkdir(path.dirname(file), { recursive:true });
    await writeFile(temp, JSON.stringify(project,null,2));
    await rename(temp,file);
  }
}

export class CreativeMemoryRepository {
  constructor(private readonly root: string) {}
  private file(projectId: string) { return path.join(this.root, "creative-memory", `${projectId}.json`); }
  async load(projectId: string): Promise<CreativeMemory | undefined> {
    try { return JSON.parse(await readFile(this.file(projectId), "utf8")) as CreativeMemory; }
    catch { return undefined; }
  }
  async save(memory: CreativeMemory) {
    await mkdir(path.dirname(this.file(memory.projectId)), { recursive:true });
    await writeFile(this.file(memory.projectId), JSON.stringify(memory,null,2));
  }
}
