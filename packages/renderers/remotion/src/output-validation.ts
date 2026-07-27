import {execFile} from "node:child_process";
import {stat} from "node:fs/promises";
import {promisify} from "node:util";
const exec=promisify(execFile);
export interface ProbeResult{codec:string;width:number;height:number;fps:number;durationSeconds:number;hasAudio:boolean;sizeBytes:number;}
export async function validateMp4(path:string,ffprobePath:string,expected:{width:number;height:number;fps:number;durationSeconds:number;audio:boolean}):Promise<ProbeResult>{
  const [{stdout},file]=await Promise.all([exec(ffprobePath,["-v","error","-show_streams","-show_format","-of","json",path]),stat(path)]);
  const data=JSON.parse(stdout) as {streams:Array<{codec_type:string;codec_name:string;width?:number;height?:number;r_frame_rate?:string}>;format:{duration?:string}};
  const video=data.streams.find((item)=>item.codec_type==="video"),audio=data.streams.some((item)=>item.codec_type==="audio");
  if(!video||video.codec_name!=="h264")throw new Error("FFprobe did not find an H.264 video stream.");
  if(video.width!==expected.width||video.height!==expected.height)throw new Error("Rendered dimensions do not match the export.");
  const [n,d]=(video.r_frame_rate??"0/1").split("/").map(Number),fps=(n??0)/(d||1),durationSeconds=Number(data.format.duration??0);
  if(Math.abs(fps-expected.fps)>.1||Math.abs(durationSeconds-expected.durationSeconds)>.35)throw new Error("Rendered FPS or duration is outside tolerance.");
  if(expected.audio&&!audio)throw new Error("Narration was expected but no audio stream exists.");
  if(file.size<10_000)throw new Error("Rendered MP4 is unexpectedly small.");
  return{codec:video.codec_name,width:video.width!,height:video.height!,fps,durationSeconds,hasAudio:audio,sizeBytes:file.size};
}
