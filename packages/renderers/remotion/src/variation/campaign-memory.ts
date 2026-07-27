import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import type {VariationProfile} from "../project-schema";
export interface CampaignFingerprint {campaignId:string;projectId:string;fingerprint:string;profile:VariationProfile;assetIds:string[];createdAt:string;}
export class CampaignMemoryRepository {
  constructor(private readonly root:string){}
  private file(campaignId:string){return path.join(this.root,"creative-memory",`${campaignId}-visual-fingerprints.json`);}
  async recent(campaignId:string,limit=20):Promise<CampaignFingerprint[]>{
    try{return (JSON.parse(await readFile(this.file(campaignId),"utf8")) as CampaignFingerprint[]).slice(-limit);}catch{return[];}
  }
  async remember(entry:CampaignFingerprint){
    const entries=await this.recent(entry.campaignId,99);entries.push(entry);
    const file=this.file(entry.campaignId),temporary=`${file}.${process.pid}.tmp`;await mkdir(path.dirname(file),{recursive:true});
    await writeFile(temporary,JSON.stringify(entries.slice(-100),null,2));await rename(temporary,file);
  }
}
