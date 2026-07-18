import type { Metadata } from "next";
import { NarrationStudio } from "./narration-studio";

export const metadata: Metadata = { title: "AI Video Generator" };

export default function AiVideoPage() {
  return (
    <>
      <header className="app-header"><div><h1>AI Video Generator</h1><p className="workspace-label">Script to a finished Plandome advert—with Ella, UK visuals, voiceover and motion.</p></div></header>
      <NarrationStudio />
    </>
  );
}
