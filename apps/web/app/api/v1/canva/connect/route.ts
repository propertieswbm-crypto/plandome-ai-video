import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canvaConfig, challenge, createCanvaVideoDesign, randomToken, refreshAccess, seal, unseal, type CanvaSession } from "@/lib/canva/connect";

export const runtime="nodejs";
export const maxDuration=60;

export async function GET(request:Request){
  const url=new URL(request.url),jobId=url.searchParams.get("job");
  if(!jobId)return NextResponse.json({detail:"A video job is required."},{status:422});
  try{
    const config=canvaConfig(url.origin),jar=await cookies();
    const session=unseal<CanvaSession>(jar.get("plandome-canva-session")?.value,config.sessionSecret);
    if(session?.refreshToken){try{const token=await refreshAccess(config,session.refreshToken);const result=await createCanvaVideoDesign(jobId,token.access_token!);if(token.refresh_token)jar.set("plandome-canva-session",seal({refreshToken:token.refresh_token},config.sessionSecret),cookieOptions());return NextResponse.redirect(result.editUrl)}catch{jar.delete("plandome-canva-session")}}
    const state=randomToken(),verifier=randomToken();
    jar.set("plandome-canva-oauth",seal({state,verifier,jobId},config.sessionSecret),{...cookieOptions(),maxAge:600});
    const authorize=new URL("https://www.canva.com/api/oauth/authorize");
    authorize.search=new URLSearchParams({code_challenge:challenge(verifier),code_challenge_method:"s256",scope:"asset:write design:content:write",response_type:"code",client_id:config.clientId,state,redirect_uri:config.redirectUri}).toString();
    return NextResponse.redirect(authorize);
  }catch(error){return NextResponse.json({detail:error instanceof Error?error.message:"Canva connection failed."},{status:503})}
}
function cookieOptions(){return {httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",maxAge:60*60*24*30}}
