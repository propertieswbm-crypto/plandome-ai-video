import type React from "react";
import {AbsoluteFill,Img,interpolate,spring,useCurrentFrame,useVideoConfig} from "remotion";
import type {CreativeScene} from "../../../../creative-project/src/types";
import type {LayoutId,VariationProfile} from "../project-schema";

const NAVY="#071a2d",CREAM="#f7f3ea",GOLD="#b9975b",WHITE="#ffffff",RED="#a34a3c";
export interface SceneProps {scene:CreativeScene;media?:string;logo:string;layout:LayoutId;variation:VariationProfile;sceneIndex:number;}
const clamp={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const};
const Brand:React.FC<{src:string;light?:boolean}>=({src,light})=><div style={{position:"absolute",top:54,left:58,zIndex:30,padding:"13px 18px",background:light?"rgba(247,243,234,.94)":"rgba(255,255,255,.94)",boxShadow:"0 12px 35px rgba(0,0,0,.13)"}}><Img src={src} style={{display:"block",width:190,height:48,objectFit:"contain"}}/></div>;
const Eyebrow:React.FC<React.PropsWithChildren<{colour?:string}>>=({children,colour=GOLD})=><div style={{color:colour,fontSize:26,fontWeight:700,letterSpacing:5,textTransform:"uppercase",marginBottom:28}}>{children}</div>;
const Caption:React.FC<{text:string;dark?:boolean}>=({text,dark=true})=><div style={{position:"absolute",left:70,right:70,bottom:92,zIndex:40,display:"flex",justifyContent:"center"}}><div style={{padding:"18px 30px",background:dark?"rgba(7,26,45,.94)":"rgba(247,243,234,.94)",color:dark?CREAM:NAVY,fontSize:44,fontWeight:600,lineHeight:1.12,textAlign:"center",boxShadow:"0 14px 45px rgba(0,0,0,.22)"}}>{text}</div></div>;
const Photo:React.FC<{src?:string;scale:number;position?:string}>=({src,scale,position="center"})=>src?<Img src={src} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:position,transform:`scale(${scale})`}}/>:<AbsoluteFill style={{background:NAVY}}/>;
const Line:React.FC<{x:number;y:number;width:number;progress:number;vertical?:boolean}>=({x,y,width,progress,vertical})=><div style={{position:"absolute",left:x,top:y,width:vertical?2:width*progress,height:vertical?width*progress:2,background:GOLD,opacity:.75}}/>;

const Hook:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:90}}),scale=interpolate(frame,[0,durationInFrames],[1.02,1.11],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center 48%"/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.94) 0%,rgba(7,26,45,.69) 48%,rgba(7,26,45,.08) 82%)"}}/><Brand src={logo}/><Line x={70} y={340} width={410} progress={enter}/><Line x={70} y={340} width={280} progress={enter} vertical/><div style={{position:"absolute",left:72,top:520,width:850,color:WHITE,opacity:enter,transform:`translateY(${(1-enter)*60}px)`}}><Eyebrow>Plandome / Building Regulations</Eyebrow><div style={{fontSize:112,fontWeight:800,lineHeight:.94,letterSpacing:-5,maxWidth:820}}>Your extension needs the right checks</div><div style={{marginTop:46,fontSize:38,lineHeight:1.25,maxWidth:690,color:"#e8e1d5"}}>Start with clarity before construction begins.</div></div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Risk:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:16,stiffness:100}}),scale=interpolate(frame,[0,durationInFrames],[1.12,1.03],clamp),line=interpolate(frame,[12,65],[0,1],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center 55%"/><AbsoluteFill style={{background:"linear-gradient(180deg,rgba(7,26,45,.18),rgba(7,26,45,.93) 76%)"}}/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.8),transparent 70%)"}}/><Brand src={logo}/><div style={{position:"absolute",left:70,top:440,width:830,color:WHITE,opacity:enter}}><Eyebrow colour="#d3ab65">Construction risk / inspect first</Eyebrow><div style={{fontSize:104,fontWeight:800,lineHeight:.95,letterSpacing:-4}}>Poor foundations create risk</div></div><div style={{position:"absolute",left:72,top:990,width:920,display:"flex",gap:20}}>{[["01","Load path"],["02","Drainage route"],["03","Existing structure"]].map(([n,t],i)=><div key={t} style={{width:275,padding:"24px 22px",borderTop:`4px solid ${i===0?RED:GOLD}`,background:"rgba(7,26,45,.86)",color:WHITE,opacity:interpolate(line,[i*.18,Math.min(1,i*.18+.55)],[0,1],clamp),transform:`translateY(${(1-line)*25}px)`}}><div style={{fontSize:22,color:GOLD,fontWeight:800}}>{n}</div><div style={{fontSize:30,fontWeight:700,marginTop:8}}>{t}</div></div>)}</div><div style={{position:"absolute",left:72,top:870,width:620,height:3,background:`linear-gradient(90deg,${GOLD} ${line*100}%,transparent 0)`}}/><Caption text={scene.narration}/></AbsoluteFill>;
};

const Technical:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:85}}),scale=interpolate(frame,[0,durationInFrames],[1.02,1.08],clamp),draw=interpolate(frame,[10,72],[0,1],clamp);
  const labels=[{x:570,y:690,t:"FOUNDATION",w:210},{x:650,y:910,t:"DRAINAGE",w:220},{x:440,y:1170,t:"STRUCTURE",w:300}];
  return <AbsoluteFill style={{background:CREAM,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><div style={{position:"absolute",inset:"0 0 0 300px",overflow:"hidden"}}><Photo src={media} scale={scale} position="65% center"/><AbsoluteFill style={{background:"rgba(7,26,45,.12)"}}/></div><div style={{position:"absolute",left:0,top:0,bottom:0,width:390,background:NAVY,color:WHITE,padding:"360px 54px 0"}}><Eyebrow>Technical review</Eyebrow><div style={{fontSize:82,fontWeight:800,lineHeight:.96,letterSpacing:-3}}>We inspect the structure</div><div style={{marginTop:42,fontSize:32,lineHeight:1.32,color:"#d7d2c8"}}>Evidence-led checks across the critical details.</div></div><Brand src={logo}/>{labels.map((l,i)=><div key={l.t} style={{position:"absolute",left:l.x,top:l.y,opacity:interpolate(draw,[i*.2,Math.min(1,i*.2+.45)],[0,1],clamp)}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:16,height:16,borderRadius:"50%",background:GOLD,boxShadow:`0 0 0 8px rgba(185,151,91,.25)`}}/><div style={{height:2,width:l.w*draw,background:GOLD}}/></div><div style={{marginTop:10,padding:"10px 14px",display:"inline-block",background:NAVY,color:WHITE,fontSize:24,fontWeight:800,letterSpacing:2}}>{l.t}</div></div>)}<div style={{position:"absolute",right:65,top:84,padding:"12px 18px",background:CREAM,color:NAVY,fontSize:24,fontWeight:700,opacity:enter}}>DRAWING 03 / TECHNICAL CHECK</div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Solution:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),enter=spring({frame,fps:30,config:{damping:18,stiffness:80}}),page=interpolate(frame,[0,70],[50,0],clamp);
  const rows=["Written Technical Review","45-minute Teams Session","Recommended Next Steps"];
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><div style={{position:"absolute",inset:"0 0 0 43%",overflow:"hidden",clipPath:"polygon(10% 0,100% 0,100% 100%,0 100%)"}}><Photo src={media} scale={1.04} position="center"/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.45),transparent 50%)"}}/></div><Brand src={logo}/><div style={{position:"absolute",left:65,top:330,width:560,color:WHITE}}><Eyebrow>Your Decision Pack</Eyebrow><div style={{fontSize:92,fontWeight:800,lineHeight:.96,letterSpacing:-4}}>A clear route forward</div><div style={{marginTop:36,fontSize:34,lineHeight:1.3,color:"#ded8ce"}}>A concise professional review, delivered with practical next steps.</div></div><div style={{position:"absolute",left:65,top:930,width:610,background:CREAM,padding:"42px 40px",boxShadow:"0 28px 80px rgba(0,0,0,.35)",opacity:enter,transform:`translateY(${page}px)`}}><div style={{fontSize:24,color:GOLD,fontWeight:800,letterSpacing:3}}>INCLUDED</div>{rows.map((r,i)=><div key={r} style={{display:"flex",gap:18,alignItems:"center",padding:"25px 0",borderBottom:i<2?"1px solid #d9d1c3":"none"}}><div style={{width:28,height:28,border:`3px solid ${GOLD}`,display:"flex",alignItems:"center",justifyContent:"center",color:NAVY,fontSize:18,fontWeight:900}}>✓</div><div style={{fontSize:31,color:NAVY,fontWeight:700}}>{r}</div></div>)}</div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Cta:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:75}}),scale=interpolate(frame,[0,durationInFrames],[1.08,1.02],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center"/><AbsoluteFill style={{background:"linear-gradient(180deg,rgba(7,26,45,.48),rgba(7,26,45,.97) 68%)"}}/><Brand src={logo}/><div style={{position:"absolute",left:70,right:70,top:370,color:WHITE,textAlign:"center",opacity:enter,transform:`translateY(${(1-enter)*45}px)`}}><Eyebrow>Building Regulations Decision Pack</Eyebrow><div style={{fontSize:118,fontWeight:800,lineHeight:.92,letterSpacing:-5}}>Request Your<br/>Decision Pack</div><div style={{display:"flex",justifyContent:"center",alignItems:"baseline",gap:18,marginTop:45}}><span style={{fontSize:52,color:GOLD,fontWeight:700}}>£</span><span style={{fontSize:102,fontWeight:800}}>99</span></div><div style={{fontSize:34,marginTop:12,color:"#e1dbd0"}}>Written Report + 45-minute Teams Session</div><div style={{display:"inline-block",marginTop:52,padding:"25px 54px",background:GOLD,color:NAVY,fontSize:34,fontWeight:800,letterSpacing:.5}}>REQUEST YOUR DECISION PACK</div><div style={{marginTop:42,fontSize:34,fontWeight:700,letterSpacing:2}}>+44 7835 397683</div></div><Caption text={scene.narration}/></AbsoluteFill>;
};

export const PlandomeScene:React.FC<SceneProps>=(props)=>{
  if(props.sceneIndex===0)return <Hook {...props}/>;
  if(props.sceneIndex===1)return <Risk {...props}/>;
  if(props.sceneIndex===2)return <Technical {...props}/>;
  if(props.sceneIndex===3)return <Solution {...props}/>;
  return <Cta {...props}/>;
};
export const PremiumEditorialProperty=PlandomeScene;
export const TechnicalBlueprint=PlandomeScene;
export const PlanningDocument=PlandomeScene;
export const ConstructionRisk=PlandomeScene;
export const FinancialAppraisal=PlandomeScene;
export const CaseStudyProof=PlandomeScene;
export const BeforeAfter=PlandomeScene;
export const ProcessExplanation=PlandomeScene;
export const ReportReview=PlandomeScene;
export const BrandedCta=PlandomeScene;
import type React from "react";
import {AbsoluteFill,Img,interpolate,spring,useCurrentFrame,useVideoConfig} from "remotion";
import type {CreativeScene} from "../../../../creative-project/src/types";
import type {LayoutId,VariationProfile} from "../project-schema";

const NAVY="#071a2d",CREAM="#f7f3ea",GOLD="#b9975b",WHITE="#ffffff",RED="#a34a3c";
export interface SceneProps {scene:CreativeScene;media?:string;logo:string;layout:LayoutId;variation:VariationProfile;sceneIndex:number;}
const clamp={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const};
const Brand:React.FC<{src:string;light?:boolean}>=({src,light})=><div style={{position:"absolute",top:54,left:58,zIndex:30,padding:"13px 18px",background:light?"rgba(247,243,234,.94)":"rgba(255,255,255,.94)",boxShadow:"0 12px 35px rgba(0,0,0,.13)"}}><Img src={src} style={{display:"block",width:190,height:48,objectFit:"contain"}}/></div>;
const Eyebrow:React.FC<React.PropsWithChildren<{colour?:string}>>=({children,colour=GOLD})=><div style={{color:colour,fontSize:26,fontWeight:700,letterSpacing:5,textTransform:"uppercase",marginBottom:28}}>{children}</div>;
const Caption:React.FC<{text:string;dark?:boolean}>=({text,dark=true})=><div style={{position:"absolute",left:70,right:70,bottom:92,zIndex:40,display:"flex",justifyContent:"center"}}><div style={{padding:"18px 30px",background:dark?"rgba(7,26,45,.94)":"rgba(247,243,234,.94)",color:dark?CREAM:NAVY,fontSize:44,fontWeight:600,lineHeight:1.12,textAlign:"center",boxShadow:"0 14px 45px rgba(0,0,0,.22)"}}>{text}</div></div>;
const Photo:React.FC<{src?:string;scale:number;position?:string}>=({src,scale,position="center"})=>src?<Img src={src} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:position,transform:`scale(${scale})`}}/>:<AbsoluteFill style={{background:NAVY}}/>;
const Line:React.FC<{x:number;y:number;width:number;progress:number;vertical?:boolean}>=({x,y,width,progress,vertical})=><div style={{position:"absolute",left:x,top:y,width:vertical?2:width*progress,height:vertical?width*progress:2,background:GOLD,opacity:.75}}/>;

const Hook:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:90}}),scale=interpolate(frame,[0,durationInFrames],[1.02,1.11],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center 48%"/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.94) 0%,rgba(7,26,45,.69) 48%,rgba(7,26,45,.08) 82%)"}}/><Brand src={logo}/><Line x={70} y={340} width={410} progress={enter}/><Line x={70} y={340} width={280} progress={enter} vertical/><div style={{position:"absolute",left:72,top:520,width:850,color:WHITE,opacity:enter,transform:`translateY(${(1-enter)*60}px)`}}><Eyebrow>Plandome / Building Regulations</Eyebrow><div style={{fontSize:112,fontWeight:800,lineHeight:.94,letterSpacing:-5,maxWidth:820}}>Your extension needs the right checks</div><div style={{marginTop:46,fontSize:38,lineHeight:1.25,maxWidth:690,color:"#e8e1d5"}}>Start with clarity before construction begins.</div></div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Risk:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:16,stiffness:100}}),scale=interpolate(frame,[0,durationInFrames],[1.12,1.03],clamp),line=interpolate(frame,[12,65],[0,1],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center 55%"/><AbsoluteFill style={{background:"linear-gradient(180deg,rgba(7,26,45,.18),rgba(7,26,45,.93) 76%)"}}/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.8),transparent 70%)"}}/><Brand src={logo}/><div style={{position:"absolute",left:70,top:440,width:830,color:WHITE,opacity:enter}}><Eyebrow colour="#d3ab65">Construction risk / inspect first</Eyebrow><div style={{fontSize:104,fontWeight:800,lineHeight:.95,letterSpacing:-4}}>Poor foundations create risk</div></div><div style={{position:"absolute",left:72,top:990,width:920,display:"flex",gap:20}}>{[["01","Load path"],["02","Drainage route"],["03","Existing structure"]].map(([n,t],i)=><div key={t} style={{width:275,padding:"24px 22px",borderTop:`4px solid ${i===0?RED:GOLD}`,background:"rgba(7,26,45,.86)",color:WHITE,opacity:interpolate(line,[i*.18,Math.min(1,i*.18+.55)],[0,1],clamp),transform:`translateY(${(1-line)*25}px)`}}><div style={{fontSize:22,color:GOLD,fontWeight:800}}>{n}</div><div style={{fontSize:30,fontWeight:700,marginTop:8}}>{t}</div></div>)}</div><div style={{position:"absolute",left:72,top:870,width:620,height:3,background:`linear-gradient(90deg,${GOLD} ${line*100}%,transparent 0)`}}/><Caption text={scene.narration}/></AbsoluteFill>;
};

const Technical:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:85}}),scale=interpolate(frame,[0,durationInFrames],[1.02,1.08],clamp),draw=interpolate(frame,[10,72],[0,1],clamp);
  const labels=[{x:440,y:690,t:"FOUNDATION",w:250},{x:650,y:910,t:"DRAINAGE",w:220},{x:440,y:1170,t:"STRUCTURE",w:300}];
  return <AbsoluteFill style={{background:CREAM,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><div style={{position:"absolute",inset:"0 0 0 300px",overflow:"hidden"}}><Photo src={media} scale={scale} position="65% center"/><AbsoluteFill style={{background:"rgba(7,26,45,.12)"}}/></div><div style={{position:"absolute",left:0,top:0,bottom:0,width:390,background:NAVY,color:WHITE,padding:"360px 54px 0"}}><Eyebrow>Technical review</Eyebrow><div style={{fontSize:82,fontWeight:800,lineHeight:.96,letterSpacing:-3}}>We inspect the structure</div><div style={{marginTop:42,fontSize:32,lineHeight:1.32,color:"#d7d2c8"}}>Evidence-led checks across the critical details.</div></div><Brand src={logo}/>{labels.map((l,i)=><div key={l.t} style={{position:"absolute",left:l.x,top:l.y,opacity:interpolate(draw,[i*.2,Math.min(1,i*.2+.45)],[0,1],clamp)}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:16,height:16,borderRadius:"50%",background:GOLD,boxShadow:`0 0 0 8px rgba(185,151,91,.25)`}}/><div style={{height:2,width:l.w*draw,background:GOLD}}/></div><div style={{marginTop:10,padding:"10px 14px",display:"inline-block",background:NAVY,color:WHITE,fontSize:24,fontWeight:800,letterSpacing:2}}>{l.t}</div></div>)}<div style={{position:"absolute",right:65,top:84,padding:"12px 18px",background:CREAM,color:NAVY,fontSize:24,fontWeight:700,opacity:enter}}>DRAWING 03 / TECHNICAL CHECK</div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Solution:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),enter=spring({frame,fps:30,config:{damping:18,stiffness:80}}),page=interpolate(frame,[0,70],[50,0],clamp);
  const rows=["Written Technical Review","45-minute Teams Session","Recommended Next Steps"];
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><div style={{position:"absolute",inset:"0 0 0 43%",overflow:"hidden",clipPath:"polygon(10% 0,100% 0,100% 100%,0 100%)"}}><Photo src={media} scale={1.04} position="center"/><AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.45),transparent 50%)"}}/></div><Brand src={logo}/><div style={{position:"absolute",left:65,top:330,width:560,color:WHITE}}><Eyebrow>Your Decision Pack</Eyebrow><div style={{fontSize:92,fontWeight:800,lineHeight:.96,letterSpacing:-4}}>A clear route forward</div><div style={{marginTop:36,fontSize:34,lineHeight:1.3,color:"#ded8ce"}}>A concise professional review, delivered with practical next steps.</div></div><div style={{position:"absolute",left:65,top:930,width:610,background:CREAM,padding:"42px 40px",boxShadow:"0 28px 80px rgba(0,0,0,.35)",opacity:enter,transform:`translateY(${page}px)`}}><div style={{fontSize:24,color:GOLD,fontWeight:800,letterSpacing:3}}>INCLUDED</div>{rows.map((r,i)=><div key={r} style={{display:"flex",gap:18,alignItems:"center",padding:"25px 0",borderBottom:i<2?"1px solid #d9d1c3":"none"}}><div style={{width:28,height:28,border:`3px solid ${GOLD}`,display:"flex",alignItems:"center",justifyContent:"center",color:NAVY,fontSize:18,fontWeight:900}}>✓</div><div style={{fontSize:31,color:NAVY,fontWeight:700}}>{r}</div></div>)}</div><Caption text={scene.narration}/></AbsoluteFill>;
};

const Cta:React.FC<SceneProps>=({scene,media,logo})=>{
  const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),enter=spring({frame,fps:30,config:{damping:18,stiffness:75}}),scale=interpolate(frame,[0,durationInFrames],[1.08,1.02],clamp);
  return <AbsoluteFill style={{background:NAVY,fontFamily:"Montserrat,Arial,sans-serif",overflow:"hidden"}}><Photo src={media} scale={scale} position="center"/><AbsoluteFill style={{background:"linear-gradient(180deg,rgba(7,26,45,.48),rgba(7,26,45,.97) 68%)"}}/><Brand src={logo}/><div style={{position:"absolute",left:70,right:70,top:370,color:WHITE,textAlign:"center",opacity:enter,transform:`translateY(${(1-enter)*45}px)`}}><Eyebrow>Building Regulations Decision Pack</Eyebrow><div style={{fontSize:118,fontWeight:800,lineHeight:.92,letterSpacing:-5}}>Request Your<br/>Decision Pack</div><div style={{display:"flex",justifyContent:"center",alignItems:"baseline",gap:18,marginTop:45}}><span style={{fontSize:52,color:GOLD,fontWeight:700}}>£</span><span style={{fontSize:102,fontWeight:800}}>99</span></div><div style={{fontSize:34,marginTop:12,color:"#e1dbd0"}}>Written Report + 45-minute Teams Session</div><div style={{display:"inline-block",marginTop:52,padding:"25px 54px",background:GOLD,color:NAVY,fontSize:34,fontWeight:800,letterSpacing:.5}}>REQUEST YOUR DECISION PACK</div><div style={{marginTop:42,fontSize:34,fontWeight:700,letterSpacing:2}}>+44 7835 397683</div></div><Caption text={scene.narration}/></AbsoluteFill>;
};

export const PlandomeScene:React.FC<SceneProps>=(props)=>{
  if(props.sceneIndex===0)return <Hook {...props}/>;
  if(props.sceneIndex===1)return <Risk {...props}/>;
  if(props.sceneIndex===2)return <Technical {...props}/>;
  if(props.sceneIndex===3)return <Solution {...props}/>;
  return <Cta {...props}/>;
};
export const PremiumEditorialProperty=PlandomeScene;
export const TechnicalBlueprint=PlandomeScene;
export const PlanningDocument=PlandomeScene;
export const ConstructionRisk=PlandomeScene;
export const FinancialAppraisal=PlandomeScene;
export const CaseStudyProof=PlandomeScene;
export const BeforeAfter=PlandomeScene;
export const ProcessExplanation=PlandomeScene;
export const ReportReview=PlandomeScene;
export const BrandedCta=PlandomeScene;
