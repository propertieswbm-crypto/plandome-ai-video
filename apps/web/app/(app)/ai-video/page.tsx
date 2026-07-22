import type { Metadata } from "next";
import { NarrationStudio } from "./narration-studio";

export const metadata: Metadata = { title: "AI Video Generator" };

export default function AiVideoPage() {
  return (
    <>
      <header className="generator-header">
        <div>
          <div className="generator-status"><span /> Production studio online</div>
          <h1>Create a publish-ready video</h1>
          <p>Turn one script into a complete Plandome advert with matched UK visuals, narration, captions and motion.</p>
        </div>
        <div className="generator-runtime"><span>Cloud rendering</span><strong>24/7</strong></div>
      </header>
      <NarrationStudio />
    </>
  );
}
