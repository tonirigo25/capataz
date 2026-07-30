import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

const outputPath = path.resolve(
  process.argv[2] || "public/media/orqena-marketing/orqena-field-os-film-v1.mp4",
);
const resumeVideoId = process.argv[3] || null;

const prompt = `
Create a polished 16-second cinematic B2B SaaS marketing film for a fictional
Spanish small construction and field-services company. This is premium,
credible commercial footage with real physical movement, not a slideshow.

Shot 1, 0-4 seconds: smooth shoulder-height dolly through a bright, organized
renovation site. A fictional adult business owner walks naturally while
reviewing a tablet; craftspeople coordinate safely in the background.

Shot 2, 4-8 seconds: a motivated camera move closes in on hands scanning a
supplier invoice with a smartphone. The paper has no legible personal or
commercial information. A tablet nearby has a clean neutral screen reserved
for a product-interface overlay in post-production.

Shot 3, 8-12 seconds: seamless match cut to a small modern office. A fictional
three-person team reviews planning, costs and upcoming collections on a laptop.
Natural gestures, focus pull from the screen to the team's coordinated work.

Shot 4, 12-16 seconds: the owner walks through the nearly finished space,
checks the phone, and acknowledges the team. The camera rises slightly and
settles on a confident, organized final composition with clear negative space
for an Orqena interface overlay.

Visual direction: sophisticated European B2B technology campaign, forest green,
warm lime accents, off-white, timber and muted concrete; natural daylight,
subtle depth of field, stable anatomy, believable tools and materials. Camera
movement must be smooth and intentional. Use coherent continuity between shots.
No dialogue. Subtle original ambient sound only.

Do not render text, captions, logos, trademarks, company names, watermarks,
real people, public figures, identifiable personal data, unsafe work practices,
distorted hands, surreal objects, fake holograms, or futuristic neon interfaces.
All device screens must remain clean, neutral and suitable for a real product
UI overlay.
`.trim();

const authorization = { Authorization: `Bearer ${apiKey}` };
let video;
if (resumeVideoId) {
  const statusResponse = await fetch(`https://api.openai.com/v1/videos/${resumeVideoId}`, {
    headers: authorization,
  });
  if (!statusResponse.ok) throw new Error(`VIDEO_RESUME_FAILED_${statusResponse.status}`);
  video = await statusResponse.json();
  console.log(JSON.stringify({ event: "video_resumed", id: video.id, status: video.status }));
} else {
  const form = new FormData();
  form.set("model", "sora-2-pro");
  form.set("size", "1920x1080");
  form.set("seconds", "16");
  form.set("prompt", prompt);

  const createdResponse = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: authorization,
    body: form,
  });

  if (!createdResponse.ok) {
    const error = await createdResponse.text();
    throw new Error(`VIDEO_CREATE_FAILED_${createdResponse.status}: ${error.slice(0, 500)}`);
  }

  video = await createdResponse.json();
  console.log(JSON.stringify({
    event: "video_started",
    id: video.id,
    model: video.model,
    seconds: video.seconds,
    size: video.size,
    status: video.status,
  }));
}

const deadline = Date.now() + 45 * 60 * 1000;
while (video.status === "queued" || video.status === "in_progress") {
  if (Date.now() > deadline) throw new Error("VIDEO_RENDER_TIMEOUT");
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  const statusResponse = await fetch(`https://api.openai.com/v1/videos/${video.id}`, {
    headers: authorization,
  });
  if (!statusResponse.ok) throw new Error(`VIDEO_STATUS_FAILED_${statusResponse.status}`);
  video = await statusResponse.json();
  console.log(JSON.stringify({
    event: "video_progress",
    id: video.id,
    progress: video.progress ?? 0,
    status: video.status,
  }));
}

if (video.status !== "completed") {
  throw new Error(`VIDEO_RENDER_${String(video.status).toUpperCase()}`);
}

const contentResponse = await fetch(`https://api.openai.com/v1/videos/${video.id}/content`, {
  headers: authorization,
});
if (!contentResponse.ok) throw new Error(`VIDEO_DOWNLOAD_FAILED_${contentResponse.status}`);

await mkdir(path.dirname(outputPath), { recursive: true });
const bytes = Buffer.from(await contentResponse.arrayBuffer());
await writeFile(outputPath, bytes);

console.log(JSON.stringify({
  event: "video_saved",
  id: video.id,
  bytes: bytes.length,
  outputPath,
  status: video.status,
}));
