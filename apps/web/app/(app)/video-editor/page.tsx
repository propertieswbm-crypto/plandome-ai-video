import type { Metadata } from "next";
import { VideoEditor } from "./video-editor";

export const metadata: Metadata = { title: "Video Editor" };

export default function VideoEditorPage() {
  return <VideoEditor />;
}
