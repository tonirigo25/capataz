import { readdir } from "node:fs/promises";
import path from "node:path";
import { getRouteExperienceMatches } from "../lib/route-experience-manifest";

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return files.flat();
}

function toRoute(appRoot: string, filename: string) {
  const relative = path.relative(appRoot, filename).replaceAll("\\", "/");
  const segments = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "").split("/").filter(Boolean);
  const visible = segments.filter((segment) => !segment.startsWith("("));
  return `/${visible.join("/")}` || "/";
}

async function main() {
  const appRoot = path.join(process.cwd(), "app");
  const pages = (await walk(appRoot)).filter((filename) => filename.endsWith(`${path.sep}page.tsx`) || filename === path.join(appRoot, "page.tsx"));
  const coverage = pages.map((filename) => {
    const route = toRoute(appRoot, filename);
    const matches = getRouteExperienceMatches(route);
    return { route, file: path.relative(process.cwd(), filename).replaceAll("\\", "/"), matches: matches.map((match) => match.id) };
  });
  const invalid = coverage.filter((entry) => entry.matches.length !== 1);
  if (invalid.length) {
    console.error(JSON.stringify({ ok: false, invalid }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, routes: coverage.length, coverage }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
