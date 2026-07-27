export {
  CreativeMemoryRepository, CreativeProjectRepository,
} from "../../creative-project/src/repository";

export interface JobRepository<TJob> {
  get(id: string): Promise<TJob | null>;
  save(job: TJob): Promise<void>;
  claim(id: string, workerId: string): Promise<boolean>;
  heartbeat(id: string, workerId: string): Promise<void>;
  complete(id: string, workerId: string): Promise<void>;
  fail(id: string, workerId: string, reason: string): Promise<void>;
}
