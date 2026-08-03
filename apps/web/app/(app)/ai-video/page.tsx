import type { Metadata } from "next";
import { Suspense } from "react";
import { NarrationStudio } from "./narration-studio";

export const metadata: Metadata = { title: "Create Video" };

export default function AiVideoPage() {
  return (
    <>
      <header className="generator-header studio-generator-header">
        <div>
          <div className="generator-status"><span /> AI DIRECTOR / ONLINE</div>
          <h1>Imagine it.<br /><em>Direct it.</em></h1>
        </div>
        <div className="generator-runtime"><span>Creative engine</span><strong>Studio 01</strong><i>Ready to render</i></div>
      </header>
      <Suspense fallback={<div className="studio-loading" aria-label="Loading studio" />}>
        <NarrationStudio />
      </Suspense>
    </>
  );
}
