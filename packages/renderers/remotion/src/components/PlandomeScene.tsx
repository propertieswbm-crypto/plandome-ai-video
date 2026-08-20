import React from "react";
import {AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

type SceneLike={headline?:string;narration?:string;beat?:string;duration:number;templateId:string};
export type SceneProps={scene:SceneLike;media?:string;logo?:string;layout?:string;variation?:unknown;sceneIndex:number};

const GOLD="#D7B96C";
const INK="#08080A";
const WHITE="#FFFDF8";
const fallbackMedia=["/template-visuals/uk-extension-hero.jpg","/template-visuals/planning-drawings.jpg","/template-visuals/planning-specialist.jpg","/template-visuals/completed-extension.jpg"];
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const headline=(scene:SceneLike)=>String(scene.headline||scene.narration||"Planning clarity for your property").replace(/[.]+$/g,"").trim();
const isVideo=(src:string)=>/\.(mp4|mov|webm|m4v)(?:[?#]|$)|\/video(?:[/?#]|$)|[?&](?:format|type)=video/i.test(src);

const Media=({src,sceneIndex}:{src:string;sceneIndex:number})=>{
  const frame=useCurrentFrame();
  const zoom=1.02+frame*0.00075;
  const drift=[-1.1,.9,-.7,.8][sceneIndex%4]!*(frame/180);
  const style:React.CSSProperties={width:"100%",height:"100%",objectFit:"cover",filter:"brightness(.94) saturate(.92) contrast(1.04)",transform:`translateX(${drift}%) scale(${zoom})`,transformOrigin:["center","left center","right center","center top"][sceneIndex%4]};
  return isVideo(src)?<OffthreadVideo src={src} muted style={style}/>:<Img src={src} style={style}/>;
};

const Brand=({src,large=false,progress=1}:{src:string;large?:boolean;progress?:number})=><div style={{position:"absolute",left:large?74:58,top:large?72:58,transform:`scale(${.94+.06*progress})`,transformOrigin:"left top",width:large?430:350,height:large?132:106,padding:large?10:8,boxSizing:"border-box",background:"rgba(255,255,255,.97)",border:`1px solid rgba(215,185,108,${.55+.35*progress})`,boxShadow:"0 18px 48px rgba(0,0,0,.2)",zIndex:20,overflow:"hidden"}}><Img src={src} style={{width:"100%",height:"100%",objectFit:"contain",transform:"scale(1.28)"}}/></div>;
const Grid=({opacity=.06}:{opacity?:number})=><div style={{position:"absolute",inset:0,opacity,backgroundImage:"linear-gradient(rgba(215,185,108,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(215,185,108,.5) 1px,transparent 1px)",backgroundSize:"72px 72px",maskImage:"linear-gradient(180deg,black,transparent 28%,transparent 78%,black)"}}/>;
const SceneNumber=({index}:{index:number})=><div style={{position:"absolute",right:48,top:78,color:GOLD,fontSize:18,fontWeight:700,letterSpacing:4,zIndex:20}}>{String(index+1).padStart(2,"0")}</div>;
const Copy=({scene,reveal,align="left"}:{scene:SceneLike;reveal:number;align?:"left"|"center"})=><><div style={{fontFamily:"Montserrat, Helvetica Neue, sans-serif",fontSize:scene.beat==="hook"?70:50,fontWeight:800,lineHeight:1.02,letterSpacing:-1.1,textTransform:"uppercase",textAlign:align,color:WHITE,transform:`translateY(${(1-reveal)*62}px)`,opacity:reveal,textShadow:"0 5px 24px rgba(0,0,0,.64)"}}>{headline(scene)}</div><div style={{width:`${reveal*100}%`,maxWidth:align==="center"?360:420,height:4,marginTop:24,marginLeft:align==="center"?"auto":0,marginRight:align==="center"?"auto":0,background:GOLD}}/></>;

const BlueprintAccent=({draw,side="right"}:{draw:number;side?:"left"|"right"})=><div style={{position:"absolute",[side]:40,top:270,width:260,height:420,opacity:.78,clipPath:`inset(${(1-draw)*100}% 0 0 0)`,filter:"drop-shadow(0 10px 18px rgba(0,0,0,.25))"}}><svg viewBox="0 0 260 420" width="100%" height="100%"><g fill="rgba(8,8,10,.12)" stroke={GOLD} strokeWidth="3"><path d="M18 18h224v384H18z"/><path d="M18 142h224M18 278h224M98 18v124M166 142v136M106 278v124"/><path d="M36 48h44v54H36zM180 48h44v54h-44zM38 180h52v62H38zM182 180h42v62h-42zM142 316h78v50h-78z"/></g><text x="30" y="390" fill={GOLD} fontFamily="Montserrat, sans-serif" fontSize="18" letterSpacing="3">SITE REVIEW</text></svg></div>;

const Hook=({scene,media,logo,sceneIndex,reveal,line}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;line:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,.02) 34%,rgba(8,8,10,.12) 56%,rgba(8,8,10,.82) 100%)"}}/><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/><div style={{position:"absolute",left:58,top:260,width:4,height:line*380,background:GOLD}}/><div style={{position:"absolute",left:84,right:64,bottom:210}}><Copy scene={scene} reveal={reveal}/></div></AbsoluteFill>;

const EditorialLower=({scene,media,logo,sceneIndex,reveal,draw}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;draw:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,0) 38%,rgba(8,8,10,.16) 58%,rgba(8,8,10,.78) 100%)"}}/><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/><BlueprintAccent draw={draw}/><div style={{position:"absolute",left:58,right:64,bottom:220}}><Copy scene={scene} reveal={reveal}/></div></AbsoluteFill>;

const EditorialRail=({scene,media,logo,sceneIndex,reveal,draw}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;draw:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(8,8,10,.72) 0%,rgba(8,8,10,.32) 48%,rgba(8,8,10,.02) 78%)"}}/><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/><div style={{position:"absolute",left:52,top:260,bottom:250,width:draw*3,background:GOLD}}/><BlueprintAccent draw={draw} side="right"/><div style={{position:"absolute",left:84,top:720,width:610}}><Copy scene={scene} reveal={reveal}/></div></AbsoluteFill>;

const EditorialFocus=({scene,media,logo,sceneIndex,reveal,draw}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;draw:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,.04),rgba(8,8,10,.08) 42%,rgba(8,8,10,.62) 100%)"}}/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/><div style={{position:"absolute",left:46,right:46,top:235,bottom:235,borderTop:`2px solid rgba(215,185,108,${draw})`,borderRight:`2px solid rgba(215,185,108,${draw})`}}/><div style={{position:"absolute",left:72,right:72,bottom:250,padding:"32px 30px",background:"rgba(8,8,10,.38)",backdropFilter:"blur(6px)",borderLeft:`4px solid ${GOLD}`}}><Copy scene={scene} reveal={reveal}/></div></AbsoluteFill>;

const Cta=({scene,media,logo,sceneIndex,reveal,line}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;line:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,.02) 28%,rgba(8,8,10,.12) 52%,rgba(8,8,10,.78) 100%)"}}/><Grid/><Brand src={logo} large progress={reveal}/><SceneNumber index={sceneIndex}/><div style={{position:"absolute",left:68,right:68,bottom:170,textAlign:"center",opacity:reveal,transform:`translateY(${(1-reveal)*50}px)`}}><Copy scene={scene} reveal={reveal} align="center"/><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:82,marginTop:30,padding:"0 38px",border:`2px solid ${GOLD}`,background:"rgba(8,8,10,.6)",color:WHITE,fontFamily:"Montserrat, sans-serif",fontSize:25,fontWeight:800,letterSpacing:1.2}}>+44 7835 397683</div><div style={{height:3,width:`${line*62}%`,maxWidth:420,margin:"28px auto 0",background:GOLD}}/></div></AbsoluteFill>;

export const PlandomeScene:React.FC<SceneProps>=({scene,media,logo,sceneIndex})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const durationFrames=Math.max(1,Math.round(scene.duration*fps));
  const reveal=clamp(interpolate(frame,[3,Math.min(20,durationFrames*.35)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const line=clamp(interpolate(frame,[0,Math.min(24,durationFrames*.42)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const draw=clamp(interpolate(frame,[5,Math.min(32,durationFrames*.58)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const resolvedMedia=media||fallbackMedia[sceneIndex%fallbackMedia.length]!;const resolvedLogo=logo||"/brand/plandome-logo.png";
  if(scene.beat==="hook"||sceneIndex===0)return <Hook scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} line={line}/>;
  if(scene.beat==="cta")return <Cta scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} line={line}/>;
  if(sceneIndex%3===1)return <EditorialRail scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} draw={draw}/>;
  if(sceneIndex%3===2)return <EditorialFocus scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} draw={draw}/>;
  return <EditorialLower scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} draw={draw}/>;
};
