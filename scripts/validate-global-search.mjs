import fs from "node:fs";

const search = fs.readFileSync("lib/search.ts", "utf8");
const page = fs.readFileSync("app/(app)/buscar/page.tsx", "utf8");
const chrome = fs.readFileSync("components/app-chrome.tsx", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[global-search] FAIL", message);
    process.exit(1);
  }
}

for (const model of ["client", "contact", "work", "budget", "invoice", "payment", "expense", "eventoAgenda", "document"]) {
  expect(search.includes(`prisma.${model}.findMany`), `missing search source ${model}`);
}

expect(search.includes("TAKE_PER_GROUP = 8"), "global search must use a bounded take per group");
expect(search.includes("grouped(results)"), "global search must return grouped results");
expect(search.includes("function contains") && search.includes("[field]"), "search filter helper must build dynamic Prisma field objects");
expect(page.includes("No hay resultados") && page.includes("Object.entries(groups)"), "search page lacks grouped results or empty state");
expect(chrome.includes('action="/buscar"') && chrome.includes('name="q"'), "app shell search form is not wired to /buscar");
expect(!search.includes("findMany({})"), "search must not load complete tables");

console.log("[global-search] OK bounded server search across core entities and grouped UI");
