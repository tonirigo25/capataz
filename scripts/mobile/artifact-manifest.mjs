import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((value) => value.split("=", 2)));
const file = args["--file"] ? resolve(args["--file"]) : "";
const root = resolve(process.cwd());
if (!file || !existsSync(file) || relative(root, file).startsWith("..")) throw new Error("MOBILE_ARTIFACT_MUST_EXIST_INSIDE_WORKSPACE");
if (!new Set(["android-aab", "ios-xcarchive"]).has(args["--platform"])) throw new Error("MOBILE_ARTIFACT_PLATFORM_INVALID");
if (!/^[0-9a-f]{40}$/i.test(process.env.MOBILE_RELEASE_SHA ?? "")) throw new Error("MOBILE_RELEASE_SHA_INVALID");
if (!/^\d+\.\d+\.\d+$/.test(process.env.MOBILE_VERSION ?? "") || !/^[1-9]\d*$/.test(process.env.MOBILE_BUILD_NUMBER ?? "")) throw new Error("MOBILE_VERSION_INVALID");
const bytes = readFileSync(file);
console.log(JSON.stringify({ version: 1, platform: args["--platform"], artifact: basename(file), releaseSha: process.env.MOBILE_RELEASE_SHA, appVersion: process.env.MOBILE_VERSION, buildNumber: Number(process.env.MOBILE_BUILD_NUMBER), sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length }));
