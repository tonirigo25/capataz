import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/capataz-chat.tsx", "utf8");
assert.match(source, /getUserMedia\s*\(\s*\{\s*audio\s*:\s*true\s*\}\s*\)/, "Voice must request audio explicitly");
assert.match(source, /NotAllowedError|PermissionDeniedError|SecurityError/, "Voice denial must distinguish browser permission errors");
assert.match(source, /getTracks\(\)[\s\S]{0,100}\.stop\(\)/, "Voice cleanup must stop every media track");
assert.match(source, /audioChunksRef\.current\s*=\s*\[\]/, "Voice cleanup must discard captured audio chunks");
assert.match(source, /recorderRef\.current\s*=\s*null/, "Voice cleanup must clear the recorder reference");
assert.match(source, /voiceStreamRef\.current\s*=\s*null/, "Voice cleanup must clear the stream reference");
assert.match(source, /setVoiceStatus\(["']error["']\)/, "Denied permission must leave recording/transcribing state");
assert.match(source, /No tengo permiso|permiso[^"']*micrófono/i, "Denied permission needs a comprehensible message");
assert.match(source, /Reintentar/, "Denied permission UI must offer an explicit retry");
assert.doesNotMatch(source, /catch\s*\{[\s\S]{0,250}fetch\s*\(\s*["']\/api\/capataz/, "Denied permission must not submit audio or chat operations");
console.log(JSON.stringify({ ok: true, denialErrors: ["NotAllowedError", "PermissionDeniedError", "SecurityError"], cleanup: ["tracks", "chunks", "recorder", "stream"] }));
