import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jobDirectory } from "@/lib/video/job-store";
import { getRemoteObject, getRemoteVideoJob } from "@/lib/video/remote-store";

const apiBase = "https://api.canva.com/rest/v1";

export type CanvaOAuthState = { state:string; verifier:string; jobId:string };
export type CanvaSession = { refreshToken:string };

export function canvaConfig(origin:string) {
  const clientId=process.env.CANVA_CLIENT_ID;
  const clientSecret=process.env.CANVA_CLIENT_SECRET;
  const sessionSecret=process.env.CANVA_SESSION_SECRET;
  const redirectUri=process.env.CANVA_REDIRECT_URI ?? `${origin}/api/v1/canva/callback`;
  if(!clientId||!clientSecret||!sessionSecret) throw new Error("Canva integration is not configured.");
  return {clientId,clientSecret,sessionSecret,redirectUri};
}

export const randomToken=()=>randomBytes(64).toString("base64url");
export const challenge=(verifier:string)=>createHash("sha256").update(verifier).digest("base64url");

function key(secret:string){return createHash("sha256").update(secret).digest()}
export function seal(value:unknown,secret:string){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key(secret),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64url")}
export function unseal<T>(value:string|undefined,secret:string):T|null{try{if(!value)return null;const raw=Buffer.from(value,"base64url"),iv=raw.subarray(0,12),tag=raw.subarray(12,28),body=raw.subarray(28);const decipher=createDecipheriv("aes-256-gcm",key(secret),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString("utf8")) as T}catch{return null}}

async function tokenRequest(config:ReturnType<typeof canvaConfig>,body:URLSearchParams){const credentials=Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");const response=await fetch(`${apiBase}/oauth/token`,{method:"POST",headers:{authorization:`Basic ${credentials}`,"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store"});const data=await response.json() as {access_token?:string;refresh_token?:string;error_description?:string};if(!response.ok||!data.access_token)throw new Error(data.error_description??"Canva authorization failed.");return data}
export const exchangeCode=(config:ReturnType<typeof canvaConfig>,code:string,verifier:string)=>tokenRequest(config,new URLSearchParams({grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:config.redirectUri}));
export const refreshAccess=(config:ReturnType<typeof canvaConfig>,refreshToken:string)=>tokenRequest(config,new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken}));

async function videoBytes(jobId:string){if(process.env.VERCEL){const job=await getRemoteVideoJob(jobId);if(!job||job.status!=="completed")throw new Error("The finished video is not ready.");const stored=await getRemoteObject(`outputs/${jobId}.mp4`);if(!stored)throw new Error("The finished MP4 could not be found.");return Buffer.from(await stored.arrayBuffer())}return readFile(path.join(jobDirectory(jobId),"output.mp4"))}
async function canvaFetch<T>(url:string,token:string,init?:RequestInit){const response=await fetch(url,{...init,headers:{authorization:`Bearer ${token}`,...init?.headers},cache:"no-store"});const data=await response.json() as T&{message?:string};if(!response.ok)throw new Error(data.message??`Canva request failed (${response.status}).`);return data}
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function createCanvaVideoDesign(jobId:string,token:string){
  const bytes=await videoBytes(jobId);if(bytes.byteLength>500*1024*1024)throw new Error("The MP4 exceeds Canva's 500 MB upload limit.");
  const metadata=JSON.stringify({name_base64:Buffer.from(`Plandome ${jobId.slice(0,8)}`).toString("base64")});
  const uploaded=await canvaFetch<{job:{id:string;status:string;asset?:{id:string};error?:{message?:string}}}>(`${apiBase}/asset-uploads`,token,{method:"POST",headers:{"content-type":"application/octet-stream","asset-upload-metadata":metadata},body:bytes});
  let upload=uploaded.job;
  for(let attempt=0;attempt<30&&upload.status==="in_progress";attempt++){await delay(500);upload=(await canvaFetch<{job:typeof upload}>(`${apiBase}/asset-uploads/${upload.id}`,token)).job}
  if(upload.status!=="success"||!upload.asset?.id)throw new Error(upload.error?.message??"Canva did not finish importing the MP4.");
  const design=await canvaFetch<{design:{id:string;urls:{edit_url:string}}}>(`${apiBase}/designs`,token,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({design_type:{type:"custom",width:1080,height:1920},title:`Plandome advert ${jobId.slice(0,8)}`})});
  return {assetId:upload.asset.id,designId:design.design.id,editUrl:design.design.urls.edit_url};
}
