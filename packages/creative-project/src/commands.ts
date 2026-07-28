import { buildTimeline, evaluatePlan } from "./engine";
import type { CameraMove, CaptionPhrase, CreativeProject, EditableElement, ElementAnimation } from "./types";

export type EditorCommand =
  | {type:"UpdateTextContent";sceneId:string;elementId:string;content:string}
  | {type:"MoveElement";sceneId:string;elementId:string;x:number;y:number}
  | {type:"ResizeElement";sceneId:string;elementId:string;width:number;height:number}
  | {type:"UpdateElementStyle";sceneId:string;elementId:string;style:Partial<EditableElement["style"]>}
  | {type:"ReplaceAsset";sceneId:string;elementId:string;assetId:string}
  | {type:"SetMediaCrop";sceneId:string;elementId:string;crop:NonNullable<EditableElement["media"]>["crop"]}
  | {type:"SetMediaFocalPoint";sceneId:string;elementId:string;focalPoint:{x:number;y:number}}
  | {type:"ChangeSceneTemplate";sceneId:string;templateId:string}
  | {type:"ChangeSceneDuration";sceneId:string;duration:number}
  | {type:"ReorderScene";sceneId:string;toIndex:number}
  | {type:"AddElement";sceneId:string;element:EditableElement}
  | {type:"DeleteElement";sceneId:string;elementId:string}
  | {type:"DuplicateElement";sceneId:string;elementId:string;newId:string}
  | {type:"LockElement";sceneId:string;elementId:string;locked:boolean}
  | {type:"ChangeTransition";sceneId:string;transition:string}
  | {type:"ChangeAnimation";sceneId:string;elementId:string;animation:Partial<{type:ElementAnimation;duration:number;delay:number;intensity:number;easing:string}>}
  | {type:"UpdateCaption";phraseId:string;text:string;start?:number;end?:number}
  | {type:"UpdateAudioMix";narrationLufs?:number;musicLevelDb?:number;duckingDb?:number}
  | {type:"UpdateBrandSettings";phoneNumber?:string;ctaLabel?:string;fontFamily?:string}
  | {type:"SetSceneCamera";sceneId:string;move:CameraMove}
  | {type:"SetRenderer";engine:"remotion"|"hyperframes"};

export interface CommandAudit {id:string;revisionId:string;timestamp:string;userId?:string;summary:string;command:EditorCommand}
export interface CommandResult {project:CreativeProject;audit:CommandAudit[];findings:string[]}
const unit=(value:number)=>Math.max(0,Math.min(1,value));
const sceneFor=(p:CreativeProject,id:string)=>{const scene=p.scenes.find(s=>s.id===id);if(!scene)throw new Error(`Scene ${id} was not found.`);return scene};
const elementFor=(p:CreativeProject,sceneId:string,id:string)=>{const scene=sceneFor(p,sceneId);const element=scene.elements?.find(e=>e.id===id);if(!element)throw new Error(`Element ${id} was not found.`);if(element.locked)throw new Error(`Element ${id} is locked.`);return element};
const recount=(p:CreativeProject)=>{let cursor=0;p.scenes.sort((a,b)=>a.order-b.order).forEach((s,i)=>{s.order=i;s.start=cursor;if(s.enabled)cursor+=s.duration});p.brief.durationSeconds=cursor;p.timeline=buildTimeline(p.scenes,p.captions);p.quality=evaluatePlan(p.scenes)};

export function applyEditorCommands(source:CreativeProject,commands:EditorCommand[],meta:{userId?:string;now?:string}={}):CommandResult {
  const project=structuredClone(source);const timestamp=meta.now??new Date().toISOString();const revision=project.version+1;const audit:CommandAudit[]=[];
  commands.forEach((command,index)=>{
    if("sceneId" in command && sceneFor(project,command.sceneId).locked && command.type!=="ReorderScene") throw new Error(`Scene ${command.sceneId} is locked.`);
    switch(command.type){
      case "UpdateTextContent":{const e=elementFor(project,command.sceneId,command.elementId);if(command.content.length>500)throw new Error("Text exceeds 500 characters.");e.content=command.content;break}
      case "MoveElement":{const e=elementFor(project,command.sceneId,command.elementId);e.box.x=unit(command.x);e.box.y=unit(command.y);break}
      case "ResizeElement":{const e=elementFor(project,command.sceneId,command.elementId);e.box.width=Math.max(.02,unit(command.width));e.box.height=Math.max(.02,unit(command.height));break}
      case "UpdateElementStyle":Object.assign(elementFor(project,command.sceneId,command.elementId).style,command.style);break;
      case "ReplaceAsset":elementFor(project,command.sceneId,command.elementId).assetId=command.assetId;break;
      case "SetMediaCrop":{const e=elementFor(project,command.sceneId,command.elementId);if(!e.media)throw new Error("Element is not editable media.");e.media.crop={x:unit(command.crop.x),y:unit(command.crop.y),width:unit(command.crop.width),height:unit(command.crop.height)};break}
      case "SetMediaFocalPoint":{const e=elementFor(project,command.sceneId,command.elementId);if(!e.media)throw new Error("Element is not editable media.");e.media.focalPoint={x:unit(command.focalPoint.x),y:unit(command.focalPoint.y)};break}
      case "ChangeSceneTemplate":{if(!project.templates.some(t=>t.id===command.templateId))throw new Error("Template is not compatible with this project.");sceneFor(project,command.sceneId).templateId=command.templateId;break}
      case "ChangeSceneDuration":sceneFor(project,command.sceneId).duration=Math.max(.5,Math.min(30,command.duration));break;
      case "ReorderScene":{const scene=sceneFor(project,command.sceneId);project.scenes.splice(project.scenes.indexOf(scene),1);project.scenes.splice(Math.max(0,Math.min(project.scenes.length,command.toIndex)),0,scene);project.scenes.forEach((item,order)=>item.order=order);break}
      case "AddElement":{const s=sceneFor(project,command.sceneId);s.elements??=[];if(s.elements.some(e=>e.id===command.element.id))throw new Error("Element ID already exists.");s.elements.push(command.element);break}
      case "DeleteElement":{const s=sceneFor(project,command.sceneId);s.elements=(s.elements??[]).filter(e=>e.id!==command.elementId);break}
      case "DuplicateElement":{const s=sceneFor(project,command.sceneId);const e=elementFor(project,command.sceneId,command.elementId);s.elements??=[];s.elements.push({...structuredClone(e),id:command.newId,name:`${e.name} copy`,box:{...e.box,x:unit(e.box.x+.02),y:unit(e.box.y+.02)}});break}
      case "LockElement":{const e=(sceneFor(project,command.sceneId).elements??[]).find(x=>x.id===command.elementId);if(!e)throw new Error("Element was not found.");e.locked=command.locked;break}
      case "ChangeTransition":sceneFor(project,command.sceneId).transition=command.transition;break;
      case "ChangeAnimation":Object.assign(elementFor(project,command.sceneId,command.elementId).animation,command.animation);break;
      case "UpdateCaption":{const c=project.captions.find(x=>x.id===command.phraseId);if(!c)throw new Error("Caption was not found.");c.text=command.text;if(command.start!==undefined)c.start=command.start;if(command.end!==undefined)c.end=command.end;if(c.end<=c.start)throw new Error("Caption end must be after start.");break}
      case "UpdateAudioMix":{if(command.narrationLufs!==undefined)project.audio.narration.loudnessTargetLufs=command.narrationLufs;if(command.musicLevelDb!==undefined)project.audio.music.levelDb=command.musicLevelDb;if(command.duckingDb!==undefined)project.audio.music.duckingDb=command.duckingDb;break}
      case "UpdateBrandSettings":Object.assign(project.brand,command);break;
      case "SetSceneCamera":sceneFor(project,command.sceneId).camera.move=command.move;break;
      case "SetRenderer":project.rendering.engine=command.engine;break;
    }
    audit.push({id:`cmd-${revision}-${index+1}`,revisionId:`rev-${revision}`,timestamp,...(meta.userId?{userId:meta.userId}:{}),summary:command.type,command});
  });
  recount(project);project.version=revision;project.updatedAt=timestamp;project.history.push({revision,timestamp,actor:"user",action:"editor-command-batch",changes:[...new Set(commands.map(c=>c.type))]});
  return {project,audit,findings:validateEditableProject(project)};
}

export function validateEditableProject(project:CreativeProject){const findings:string[]=[];for(const scene of project.scenes){for(const e of scene.elements??[]){if(e.box.x+e.box.width>1-e.safeZone.right||e.box.y+e.box.height>1-e.safeZone.bottom)findings.push(`${e.id}: outside safe zone`);if(e.type==="text"&&(e.content?.length??0)>120)findings.push(`${e.id}: text overflow risk`);if(e.style.fontFamily&&!/Montserrat|Arial/i.test(e.style.fontFamily))findings.push(`${e.id}: unsupported font`)}}return findings}

export function defaultSceneElements(project:CreativeProject,sceneId:string):EditableElement[]{const scene=sceneFor(project,sceneId);const media=project.assets.find(a=>a.assetId===scene.selectedAssetId);return [
  {id:`${scene.id}-media`,type:media?.mediaType==="video"?"video":"image",name:"Scene media",role:"background",semanticRole:"property visual",rendererCompatibility:["remotion","hyperframes"],visible:true,locked:false,start:0,end:scene.duration,layer:0,box:{x:0,y:0,width:1,height:1,anchor:"top-left",pin:["top","right","bottom","left"]},rotation:0,opacity:1,safeZone:{top:0,right:0,bottom:0,left:0},style:{},animation:{type:"scale",duration:scene.duration,delay:0,intensity:.08,easing:"ease-out"},...(media?.assetId?{assetId:media.assetId}:{}),media:{fit:"cover",crop:{x:0,y:0,width:1,height:1},focalPoint:{x:.5,y:.5},brightness:1,contrast:1,playbackRate:1,muted:true,trimStart:0}},
  {id:`${scene.id}-headline`,type:"text",name:"Headline",role:"headline",semanticRole:"scene headline",rendererCompatibility:["remotion","hyperframes"],visible:true,locked:false,start:0,end:scene.duration,layer:20,box:{x:.09,y:.28,width:.82,height:.24,anchor:"top-left",minWidth:.2,minHeight:.06},rotation:0,opacity:1,safeZone:{top:.06,right:.06,bottom:.12,left:.06},style:{fontFamily:"Montserrat",fontWeight:800,fontSize:72,lineHeight:.98,letterSpacing:-2,textAlign:"left",colour:"#fffdf8"},animation:{type:"rise",duration:.45,delay:.08,intensity:.7,easing:"ease-out"},content:scene.headline},
  {id:`${scene.id}-logo`,type:"logo",name:"Plandome logo",role:"brand",semanticRole:"brand mark",rendererCompatibility:["remotion","hyperframes"],visible:true,locked:true,start:0,end:scene.duration,layer:40,box:{x:.055,y:.03,width:.22,height:.07,anchor:"top-left",pin:["top","left"]},rotation:0,opacity:1,safeZone:{top:.02,right:.04,bottom:.1,left:.04},style:{},animation:{type:"fade",duration:.3,delay:0,intensity:.4,easing:"linear"},assetId:"brand-logo"}
]}
