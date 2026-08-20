import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canvaConfig, createCanvaVideoDesign, exchangeCode, seal, unseal, type CanvaOAuthState } from "@/lib/canva/connect";

export const runtime="nodejs";
export const maxDuration=60;

export async function GET(request:Request){
  const url=new URL(request.url),code=url.searchParams.get("code"),state=url.searchParams.get("state"),jar=await cookies();
  try{
    const config=canvaConfig(url.origin),pending=unseal<CanvaOAuthState>(jar.get("plandome-canva-oauth")?.value,config.sessionSecret);
    if(!code||!state||!pending||state!==pending.state)throw new Error("Canva authorization could not be verified.");
    const token=await exchangeCode(config,code,pending.verifier);const result=await createCanvaVideoDesign(pending.jobId,token.access_token!);
    if(token.refresh_token)jar.set("plandome-canva-session",seal({refreshToken:token.refresh_token},config.sessionSecret),{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*24*30});
    jar.delete("plandome-canva-oauth");return NextResponse.redirect(result.editUrl);
  }catch(error){return NextResponse.redirect(new URL(`/ai-video?canvaError=${encodeURIComponent(error instanceof Error?error.message:"Canva connection failed.")}`,url.origin))}
}
