import type {Metadata} from "next";
import {CreativeVideoEditor} from "../creative-editor";
export const metadata:Metadata={title:"Plandome Video Editor"};
export default async function EditorPage({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <CreativeVideoEditor projectId={projectId}/>}
