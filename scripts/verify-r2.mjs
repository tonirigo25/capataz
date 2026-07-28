import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT", "R2_REGION"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }));
  process.exit(1);
}

const client = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: process.env.R2_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const key = `codex-smoke/${randomUUID()}.txt`;
const body = Buffer.from(`orqena-r2-smoke:${new Date().toISOString()}`);
let uploaded = false;

try {
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: "text/plain",
  }));
  uploaded = true;
  const response = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  const received = response.Body ? Buffer.from(await response.Body.transformToByteArray()) : Buffer.alloc(0);
  if (!received.equals(body)) throw new Error("R2_SMOKE_CONTENT_MISMATCH");
  console.log(JSON.stringify({ ok: true, operations: ["upload", "read", "delete"], prefix: "codex-smoke/" }));
} finally {
  if (uploaded) {
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  }
}
