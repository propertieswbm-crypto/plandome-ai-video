import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerationHistory } from "../apps/web/lib/video/creative-system";

export async function readGenerationHistory(root: string, projectId: string): Promise<GenerationHistory[]> {
  try { const all=JSON.parse(await readFile(path.join(root,".data/generation-history.json"),"utf8")) as GenerationHistory[]; return all.filter(x=>x.projectId===projectId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); } catch { return []; }
}
export async function saveGenerationHistory(root: string, record: GenerationHistory) {
  const file=path.join(root,".data/generation-history.json"); await mkdir(path.dirname(file),{recursive:true}); let all:GenerationHistory[]=[]; try { all=JSON.parse(await readFile(file,"utf8")) as GenerationHistory[]; } catch { /* first generation */ }
  const next=[record,...all.filter(x=>x.generationId!==record.generationId)].slice(0,250); await writeFile(file,JSON.stringify(next,null,2));
}
