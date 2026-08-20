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
const wordCount=(scene:SceneLike)=>headline(scene).split(/\s+/).filter(Boolean).length;
const headlineSize=(scene:SceneLike)=>scene.beat==="hook"?70:wordCount(scene)>7?46:50;
const isVideo=(src:string)=>/\.(mp4|mov|webm|m4v)(?:[?#]|$)|\/video(?:[/?#]|$)|[?&](?:format|type)=video/i.test(src);

const Media=({src,sceneIndex}:{src:string;sceneIndex:number})=>{
  const frame=useCurrentFrame();
  const zoom=1.035+frame*0.0009;
  const drift=[-1.4,1.2,-.8,.9][sceneIndex%4]!*(frame/180);
  const style:React.CSSProperties={width:"100%",height:"100%",objectFit:"cover",transform:`translateX(${drift}%) scale(${zoom})`,transformOrigin:["center","left center","right center","center top"][sceneIndex%4]};
  return isVideo(src)?<OffthreadVideo src={src} muted style={style}/>:<Img src={src} style={style}/>;
};

const Brand=({src,large=false,progress=1}:{src:string;large?:boolean;progress?:number})=><div style={{position:"absolute",left:"50%",top:large?76:64,transform:`translateX(-50%) scale(${.92+.08*progress})`,width:large?300:244,height:large?92:74,padding:large?14:11,boxSizing:"border-box",background:"rgba(255,255,255,.94)",border:`1px solid rgba(215,185,108,${.45+.35*progress})`,boxShadow:"0 18px 55px rgba(0,0,0,.2)",zIndex:20}}><Img src={src} style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>;
const Grid=()=> <div style={{position:"absolute",inset:0,opacity:.11,backgroundImage:"linear-gradient(rgba(215,185,108,.45) 1px,transparent 1px),linear-gradient(90deg,rgba(215,185,108,.45) 1px,transparent 1px)",backgroundSize:"72px 72px",maskImage:"linear-gradient(180deg,black,transparent 32%,transparent 70%,black)"}}/>;
const SceneNumber=({index}:{index:number})=><div style={{position:"absolute",right:48,top:78,color:GOLD,fontSize:18,fontWeight:700,letterSpacing:4,zIndex:20}}>{String(index+1).padStart(2,"0")}</div>;
const Copy=({scene,reveal,style}:{scene:SceneLike;reveal:number;style?:React.CSSProperties})=><div style={{position:"absolute",overflow:"hidden",...style}}><div style={{fontFamily:"Montserrat, Helvetica Neue, sans-serif",fontSize:headlineSize(scene),fontWeight:800,lineHeight:.96,letterSpacing:-1.5,textTransform:"uppercase",color:WHITE,transform:`translateY(${(1-reveal)*72}px)`,opacity:reveal,textShadow:"0 4px 22px rgba(0,0,0,.42)"}}>{headline(scene)}</div><div style={{width:`${reveal*100}%`,maxWidth:420,height:4,marginTop:26,background:GOLD}}/></div>;

const Hook=({scene,media,logo,sceneIndex,reveal,line}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;line:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}>
  <Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,.08) 32%,rgba(8,8,10,.18) 52%,rgba(8,8,10,.88) 100%)"}}/><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/>
  <div style={{position:"absolute",left:58,top:230,width:4,height:line*480,background:GOLD,boxShadow:`0 0 24px ${GOLD}`}}/><Copy scene={scene} reveal={reveal} style={{left:82,right:58,bottom:190}}/>
</AbsoluteFill>;

const Blueprint=({draw}:{draw:number})=><svg viewBox="0 0 390 1500" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
  <g fill="none" stroke={GOLD} strokeWidth="3" opacity={.82} strokeDasharray="2400" strokeDashoffset={(1-draw)*2400}>
    <path d="M44 94H340V382H245V565H344V850H238V1090H340V1374H48V1120H138V890H46V610H144V380H44Z"/><path d="M144 96V380M245 96V382M46 610H344M46 850H344M48 1120H340M138 890V1374M238 850V1374"/><path d="M70 176h48v72H70zM270 176h48v72h-48zM76 687h72v96H76zM260 687h56v96h-56zM170 1188h118v122H170z"/>
  </g><rect x="246" y="386" width="92" height="168" fill="rgba(215,185,108,.08)" stroke={GOLD} strokeWidth="4" opacity={draw}/><path d="M254 520H330" stroke={GOLD} strokeWidth="3" opacity={draw}/><text x="264" y="510" fill={GOLD} fontFamily="Montserrat, sans-serif" fontSize="24" opacity={draw}>2.4m</text>
</svg>;

const EvidenceBlueprint=({scene,media,logo,sceneIndex,reveal,draw}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;draw:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}>
  <div style={{position:"absolute",inset:0,right:"34%",overflow:"hidden"}}><Media src={media} sceneIndex={sceneIndex}/></div><div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(8,8,10,.04) 35%,rgba(8,8,10,.42) 63%,rgba(8,8,10,.96) 76%)"}}/>
  <div style={{position:"absolute",right:0,top:0,bottom:0,width:"36%",background:"rgba(8,8,10,.84)",borderLeft:"1px solid rgba(215,185,108,.5)",clipPath:`inset(0 0 0 ${(1-draw)*100}%)`}}><Blueprint draw={draw}/></div><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/><Copy scene={scene} reveal={reveal} style={{left:58,width:610,bottom:165}}/>
</AbsoluteFill>;

const EvidenceFrame=({scene,media,logo,sceneIndex,reveal,draw,reverse=false}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;draw:number;reverse?:boolean})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}>
  <Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:reverse?"linear-gradient(90deg,rgba(8,8,10,.88) 0%,rgba(8,8,10,.28) 58%,rgba(8,8,10,.04) 100%)":"linear-gradient(180deg,rgba(8,8,10,.05) 30%,rgba(8,8,10,.82) 92%)"}}/><Grid/><Brand src={logo} progress={reveal}/><SceneNumber index={sceneIndex}/>
  <div style={{position:"absolute",left:reverse?54:46,right:reverse?380:46,top:230,bottom:235,borderTop:`2px solid rgba(215,185,108,${draw})`,borderLeft:`2px solid rgba(215,185,108,${draw})`,pointerEvents:"none"}}><div style={{position:"absolute",left:-2,bottom:0,width:150*draw,height:2,background:GOLD}}/><div style={{position:"absolute",right:0,top:-2,width:2,height:150*draw,background:GOLD}}/></div>
  <Copy scene={scene} reveal={reveal} style={reverse?{left:62,width:560,top:710}:{left:58,right:58,bottom:155}}/>
</AbsoluteFill>;

const Cta=({scene,media,logo,sceneIndex,reveal,line}:{scene:SceneLike;media:string;logo:string;sceneIndex:number;reveal:number;line:number})=><AbsoluteFill style={{background:INK,overflow:"hidden"}}>
  <Media src={media} sceneIndex={sceneIndex}/><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,8,10,.04) 28%,rgba(8,8,10,.2) 51%,rgba(8,8,10,.86) 100%)"}}/><Grid/><Brand src={logo} large progress={reveal}/><SceneNumber index={sceneIndex}/>
  <div style={{position:"absolute",left:74,right:74,bottom:165,textAlign:"center",opacity:reveal,transform:`translateY(${(1-reveal)*55}px)`}}><div style={{fontFamily:"Montserrat, Helvetica Neue, sans-serif",fontSize:54,fontWeight:800,lineHeight:.96,letterSpacing:-1.5,textTransform:"uppercase",color:WHITE,textShadow:"0 4px 24px rgba(0,0,0,.48)"}}>{headline(scene)}</div><div style={{height:3,width:`${line*100}%`,margin:"30px auto 26px",background:GOLD}}/><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:74,padding:"0 34px",border:`2px solid ${GOLD}`,borderRadius:38,background:"rgba(8,8,10,.62)",color:GOLD,fontFamily:"Montserrat, sans-serif",fontSize:20,fontWeight:800,letterSpacing:1.2}}>+44 7835 397683</div></div>
</AbsoluteFill>;

export const PlandomeScene:React.FC<SceneProps>=({scene,media,logo,sceneIndex})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const durationFrames=Math.max(1,Math.round(scene.duration*fps));
  const reveal=clamp(interpolate(frame,[3,Math.min(20,durationFrames*.35)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const line=clamp(interpolate(frame,[0,Math.min(24,durationFrames*.42)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const draw=clamp(interpolate(frame,[5,Math.min(32,durationFrames*.58)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const resolvedMedia=media||fallbackMedia[sceneIndex%fallbackMedia.length]!;const resolvedLogo=logo||"/brand/plandome-logo.png";
  if(scene.beat==="hook"||sceneIndex===0)return <Hook scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} line={line}/>;
  if(scene.beat==="cta")return <Cta scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} line={line}/>;
  if(sceneIndex%3===1)return <EvidenceBlueprint scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} draw={draw}/>;
  return <EvidenceFrame scene={scene} media={resolvedMedia} logo={resolvedLogo} sceneIndex={sceneIndex} reveal={reveal} draw={draw} reverse={sceneIndex%3===0}/>;
};
