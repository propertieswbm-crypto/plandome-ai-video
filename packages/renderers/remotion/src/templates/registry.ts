import type React from "react";
import type {SceneProps} from "../components/PlandomeScene";
import {PlandomeScene} from "../components/PlandomeScene";
export interface RemotionTemplate{id:string;version:"1.0";displayName:string;families:string[];roles:string[];aspectRatios:string[];requiredAssets:string[];duration:[number,number];headlineLimit:number;transitions:string[];component:React.FC<SceneProps>;fallback:string}
const PRIMARY_TEMPLATE="architectural-editorial-primary";
export const remotionTemplates:RemotionTemplate[]=[{id:PRIMARY_TEMPLATE,version:"1.0",displayName:"Architectural Editorial Motion",families:["editorial-property","technical-blueprint","planning-document"],roles:["hook","problem","explanation","proof","solution","cta"],aspectRatios:["9:16"],requiredAssets:["video","image"],duration:[1.5,9],headlineLimit:9,transitions:["architectural-mask","tracked-blueprint","cta-rail"],component:PlandomeScene,fallback:PRIMARY_TEMPLATE}];
export const requireTemplate=(id:string)=>{const value=remotionTemplates.find((item)=>item.id===id)||remotionTemplates[0];if(!value)throw new Error(`Unknown Remotion template ${id}.`);return value;};
