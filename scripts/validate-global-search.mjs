import fs from "node:fs";

const search = fs.readFileSync("lib/search.ts", "utf8");
const page = fs.readFileSync("app/(app)/buscar/page.tsx", "utf8");
const chrome = fs.readFileSync("components/app-chrome.tsx", "utf8");
const combobox = fs.readFileSync("components/global-search-combobox.tsx", "utf8");
const suggestions = fs.readFileSync("app/api/search/suggestions/route.ts", "utf8");

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
expect(search.includes("takePerGroup") && search.includes("Math.min(TAKE_PER_GROUP"), "predictive search must never exceed the server group limit");
expect(search.includes("grouped(results)"), "global search must return grouped results");
expect(search.includes("statusLabel("), "global search must not expose internal status identifiers");
expect(search.includes("function contains") && search.includes("[field]"), "search filter helper must build dynamic Prisma field objects");
expect(search.includes("/documentos?documento=") && !search.includes('href: document.url'), "document search results must use an authorized internal route");
expect(page.includes("No hay resultados") && page.includes("Object.entries(groups)"), "search page lacks grouped results or empty state");
expect(chrome.includes("GlobalSearchCombobox") && page.includes("GlobalSearchCombobox"), "shell and complete search page must share the predictive combobox");
expect(combobox.includes('action="/buscar"') && combobox.includes('name="q"'), "predictive search fallback is not wired to /buscar");
expect(combobox.includes("SEARCH_DELAY_MS = 250") && combobox.includes("AbortController"), "predictive search must debounce and cancel stale requests");
expect(combobox.includes('role="combobox"') && combobox.includes('role="listbox"') && combobox.includes('role="option"'), "predictive search lacks accessible combobox semantics");
expect(combobox.includes("ArrowDown") && combobox.includes("ArrowUp") && combobox.includes("aria-activedescendant"), "predictive search lacks keyboard navigation");
expect(combobox.includes("orderedGroups.map") && combobox.includes('role="group"'), "predictive results must be separated by topic");
expect(suggestions.includes("MIN_QUERY_LENGTH = 2") && suggestions.includes("MAX_QUERY_LENGTH = 80"), "suggestions endpoint lacks query bounds");
expect(suggestions.includes("export async function POST") && suggestions.includes("request.json()"), "predictive queries must not be exposed in infrastructure query-string logs");
expect(suggestions.includes('requireCapability("company.view")'), "suggestions endpoint must require authenticated company access");
expect(suggestions.includes('Cache-Control": "private, no-store"') && suggestions.includes("globalSearch(query"), "suggestions endpoint must be private, uncached and use the authorized search service");
expect(!search.includes("findMany({})"), "search must not load complete tables");

console.log("[global-search] OK bounded predictive search across authorized core entities and grouped UI");
