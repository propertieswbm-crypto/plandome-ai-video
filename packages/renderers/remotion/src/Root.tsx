import React from "react";
import {AbsoluteFill,Audio,Composition,Sequence} from "remotion";
import type {RemotionRenderInput} from "./project-schema";
import {requireTemplate} from "./templates/registry";

export const PlandomeVideo:React.FC<RemotionRenderInput>=(input)=>{
  const {project,variation}=input;
  return <AbsoluteFill>{project.scenes.filter((scene)=>scene.enabled).map((scene,index)=>{
    const from=Math.round(scene.start*input.fps),durationInFrames=Math.max(1,Math.round(scene.duration*input.fps));
    const Template=requireTemplate(variation.templateSequence[index]??"premium-editorial-property").component;
    return <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} premountFor={Math.min(input.fps,durationInFrames)}>
      <Template scene={scene} media={input.sceneMedia[scene.id]} logo={input.logoPath} layout={variation.layoutSequence[index]??"full-bleed"} variation={variation} sceneIndex={index}/>
    </Sequence>;
  })}{input.narrationPath&&<Audio src={input.narrationPath}/>}</AbsoluteFill>;
};
const duration=(input:RemotionRenderInput)=>Math.max(1,Math.ceil(input.project.scenes.reduce((max,scene)=>Math.max(max,scene.start+scene.duration),0)*input.fps));
export const RemotionRoot:React.FC=()=> <Composition
  id="PlandomeVideo" component={PlandomeVideo} width={1080} height={1920} fps={30} durationInFrames={300}
  defaultProps={null as unknown as RemotionRenderInput}
  calculateMetadata={({props})=>({width:props.width,height:props.height,fps:props.fps,durationInFrames:duration(props)})}
/>;
