import type React from "react";
import type {SceneProps} from "../components/PlandomeScene";
import {BeforeAfter,BrandedCta,CaseStudyProof,ConstructionRisk,FinancialAppraisal,PlanningDocument,PremiumEditorialProperty,ProcessExplanation,ReportReview,TechnicalBlueprint} from "../components/PlandomeScene";

export interface RemotionTemplate {
  id:string;version:"1.0";displayName:string;families:string[];roles:string[];
  aspectRatios:string[];requiredAssets:string[];duration:[number,number];headlineLimit:number;
  transitions:string[];component:React.FC<SceneProps>;fallback:string;
}
export const remotionTemplates:RemotionTemplate[]=[
  ["premium-editorial-property","Premium Editorial Property",["editorial-property"],["hook","solution"],PremiumEditorialProperty],
  ["technical-blueprint","Technical Blueprint",["technical-blueprint"],["problem","explanation"],TechnicalBlueprint],
  ["planning-document","Planning Document Review",["planning-document"],["problem","proof"],PlanningDocument],
  ["construction-risk","Construction Risk",["construction-risk"],["problem","explanation"],ConstructionRisk],
  ["financial-appraisal","Financial Appraisal",["financial-analysis"],["problem","proof"],FinancialAppraisal],
  ["case-study-proof","Case Study Proof",["case-study"],["proof","solution"],CaseStudyProof],
  ["before-after","Before and After",["case-study","editorial-property"],["proof"],BeforeAfter],
  ["process-explanation","Process Explanation",["premium-corporate"],["explanation","solution"],ProcessExplanation],
  ["report-review","Report Review",["planning-document","premium-corporate"],["proof","solution"],ReportReview],
  ["branded-cta","Premium Branded CTA",["editorial-property","premium-corporate"],["cta"],BrandedCta],
  ["branded-cta-property","Property Background CTA",["editorial-property"],["cta"],BrandedCta],
  ["branded-cta-contact","Premium Contact CTA",["premium-corporate"],["cta"],BrandedCta],
].map(([id,name,families,roles,component])=>({id:String(id),version:"1.0" as const,displayName:String(name),families:families as string[],roles:roles as string[],aspectRatios:["9:16","1:1","16:9"],requiredAssets:String(id).startsWith("branded-cta")?[]:["video","image"],duration:[1.5,9],headlineLimit:90,transitions:["crossfade","clean-slide","architectural-mask"],component:component as React.FC<SceneProps>,fallback:"premium-editorial-property"}));
export const requireTemplate=(id:string)=>{const value=remotionTemplates.find((item)=>item.id===id);if(!value)throw new Error(`Unknown Remotion template ${id}.`);return value;};
