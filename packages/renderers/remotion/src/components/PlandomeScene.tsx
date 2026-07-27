import React from "react";
import {AbsoluteFill,Img,interpolate,spring,useCurrentFrame,useVideoConfig,Video} from "remotion";
import type {CreativeScene} from "../../../../creative-project/src/types";
import type {LayoutId,VariationProfile} from "../project-schema";

const NAVY="#071a2d",CREAM="#f7f3ea",GOLD="#b9975b";
export interface SceneProps {scene:CreativeScene;media?:string;logo:string;layout:LayoutId;variation:VariationProfile;sceneIndex:number;}
export const SafeArea:React.FC<React.PropsWithChildren>=({children})=><div style={{position:"absolute",inset:"7% 6% 11%",overflow:"hidden"}}>{children}</div>;
export const BrandBug:React.FC<{src:string}>=({src})=><Img src={src} style={{position:"absolute",top:34,left:42,width:230,height:72,objectFit:"contain",zIndex:20}}/>;
export const ContactFooter=()=> <div style={{position:"absolute",right:42,bottom:34,padding:"12px 18px",background:NAVY,color:CREAM,fontSize:18,letterSpacing:1.5,zIndex:20}}>+44 7835 397683</div>;
const Media:React.FC<{src?:string;layout:LayoutId;frame:number;duration:number;camera:string}>=({src,layout,frame,duration,camera})=>{
  if(!src)return <div style={{width:"100%",height:"100%",background:`linear-gradient(145deg,${NAVY},#17334c)`}}/>;
  const scale=interpolate(frame,[0,duration],[camera==="slow-pull"?1.08:1.01,camera==="slow-pull"?1.01:1.08],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const style:React.CSSProperties={width:"100%",height:"100%",objectFit:"cover",transform:`scale(${scale})`};
  const visual=/\.mp4($|\?)/i.test(src)?<Video src={src} muted style={style}/>:<Img src={src} style={style}/>;
  const radius=layout==="circular-mask"?"50%":layout==="curved-mask"?"42% 8% 42% 8%":"0";
  return <div style={{width:"100%",height:"100%",overflow:"hidden",borderRadius:radius}}>{visual}</div>;
};
export const PlandomeScene:React.FC<SceneProps>=({scene,media,logo,layout,variation,sceneIndex})=>{
  const frame=useCurrentFrame(),{fps,durationInFrames}=useVideoConfig();
  const enter=spring({frame,fps,config:{damping:18,stiffness:95}});
  const isFull=layout==="full-bleed"||layout==="lower-zone"||layout==="property-cta";
  const mediaStyle:React.CSSProperties=isFull?{position:"absolute",inset:0}:{position:"absolute",top:"15%",bottom:"15%",width:"54%",[layout==="media-left"?"left":"right"]:"0"};
  return <AbsoluteFill style={{background:CREAM,color:NAVY,fontFamily:"Montserrat, Arial, sans-serif",overflow:"hidden"}}>
    <div style={mediaStyle}><Media src={media} layout={layout} frame={frame} duration={durationInFrames} camera={variation.cameraSequence[sceneIndex]??"static"}/></div>
    {isFull&&<AbsoluteFill style={{background:"linear-gradient(90deg,rgba(7,26,45,.88),rgba(7,26,45,.12) 75%)"}}/>}
    <BrandBug src={logo}/><SafeArea><div style={{position:"absolute",left:layout==="media-left"?"58%":0,right:layout==="media-right"?"58%":0,top:"30%",opacity:enter,transform:`translateY(${(1-enter)*45}px)`,color:isFull?CREAM:NAVY}}>
      <div style={{color:GOLD,fontWeight:700,fontSize:18,letterSpacing:4,textTransform:"uppercase",marginBottom:22}}>PLANDOME / {scene.beat}</div>
      <div style={{fontWeight:800,fontSize:Math.min(64,Math.round(72*variation.typographyScale)),lineHeight:.98,maxWidth:isFull?760:520,letterSpacing:-3,overflowWrap:"anywhere"}}>{scene.headline}</div>
      <div style={{height:5,width:120,background:GOLD,marginTop:30}}/>
    </div></SafeArea>
    <div style={{position:"absolute",left:"8%",right:"8%",bottom:"9%",padding:"15px 24px",background:NAVY,color:CREAM,textAlign:"center",fontSize:28,lineHeight:1.15,maxHeight:"9%",overflow:"hidden"}}>{scene.narration}</div>
    {scene.beat==="cta"&&<ContactFooter/>}
  </AbsoluteFill>;
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
