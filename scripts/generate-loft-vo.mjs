import { readFile, writeFile } from "node:fs/promises";

const parseEnv = (text) => Object.fromEntries(
  text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const env = parseEnv(await readFile("apps/web/.env.local", "utf8"));
const text = await readFile("outputs/loft-conversion-script.txt", "utf8");
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_ELLA_VOICE_ID)}`, {
  method: "POST",
  headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
  body: JSON.stringify({
    text,
    model_id: "eleven_flash_v2_5",
    voice_settings: { stability: 0.58, similarity_boost: 0.8, style: 0.22, use_speaker_boost: true, speed: 1 },
  }),
});
if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
await writeFile("outputs/loft-conversion-vo.mp3", Buffer.from(await response.arrayBuffer()));
