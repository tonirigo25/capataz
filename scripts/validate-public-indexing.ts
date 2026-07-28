import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import {
  getPublicRobotsMetadata,
  isPublicIndexablePath,
  isPublicIndexingEnabled,
  PRIVATE_ROBOTS_METADATA,
  shouldSendNoIndexHeader,
  X_ROBOTS_TAG_VALUE,
} from "../lib/public-indexing";

const original = process.env.PUBLIC_INDEXING_ENABLED;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

try {
  delete process.env.PUBLIC_INDEXING_ENABLED;
  assert.equal(isPublicIndexingEnabled(), false);
  process.env.PUBLIC_INDEXING_ENABLED = "false";
  assert.equal(isPublicIndexingEnabled(), false);
  process.env.PUBLIC_INDEXING_ENABLED = "TRUE";
  assert.equal(isPublicIndexingEnabled(), false, "the opt-in must be exact");

  delete process.env.PUBLIC_INDEXING_ENABLED;
  const privateRobots = robots();
  assert.deepEqual(privateRobots.rules, { userAgent: "*", disallow: "/" });
  assert.equal(privateRobots.sitemap, undefined);
  assert.deepEqual(sitemap(), []);
  const privateMetadata = getPublicRobotsMetadata();
  assert.ok(privateMetadata && typeof privateMetadata === "object");
  assert.equal(privateMetadata.index, false);
  assert.equal(privateMetadata.follow, false);
  assert.equal(PRIVATE_ROBOTS_METADATA.noarchive, true);
  assert.equal(PRIVATE_ROBOTS_METADATA.nosnippet, true);
  assert.equal(PRIVATE_ROBOTS_METADATA.noimageindex, true);
  assert.equal(shouldSendNoIndexHeader("/"), true);
  assert.equal(shouldSendNoIndexHeader("/login"), true);
  assert.equal(shouldSendNoIndexHeader("/hoy"), true);

  process.env.PUBLIC_INDEXING_ENABLED = "true";
  assert.equal(isPublicIndexingEnabled(), true);
  const publicRobots = robots();
  const publicRules = Array.isArray(publicRobots.rules) ? publicRobots.rules[0] : publicRobots.rules;
  assert.equal(publicRules.userAgent, "*");
  assert.equal(publicRules.disallow, "/");
  assert.ok(Array.isArray(publicRules.allow) && publicRules.allow.includes("/producto"));
  assert.match(String(publicRobots.sitemap), /\/sitemap\.xml$/);

  for (const path of ["/", "/producto", "/producto/agenda", "/soluciones", "/soluciones/presupuestos-de-obra", "/sectores", "/sectores/construccion", "/planes", "/estado", "/recursos/calculadora-margen-obra", "/recursos/checklist-factura-recibida"]) {
    assert.equal(isPublicIndexablePath(path), true, `${path} must be publicly indexable after opt-in`);
    assert.equal(shouldSendNoIndexHeader(path), false, `${path} must not receive noindex after opt-in`);
  }
  for (const path of ["/login", "/registro", "/api/status", "/hoy", "/clientes", "/obras", "/dinero", "/tesoreria", "/equipo", "/configuracion", "/plataforma"]) {
    assert.equal(isPublicIndexablePath(path), false, `${path} must remain outside the public allowlist`);
    assert.equal(shouldSendNoIndexHeader(path), true, `${path} must retain noindex after opt-in`);
  }

  const publicSitemap = sitemap();
  assert.ok(publicSitemap.length > 20);
  for (const entry of publicSitemap) {
    const pathname = new URL(entry.url).pathname;
    assert.equal(isPublicIndexablePath(pathname), true, `${pathname} must be a public sitemap route`);
  }

  const rootLayout = read("app/layout.tsx");
  const appLayout = read("app/(app)/layout.tsx");
  const authLayout = read("app/(auth)/layout.tsx");
  const middleware = read("middleware.ts");
  const nextConfig = read("next.config.ts");
  assert.match(rootLayout, /robots:\s*getPublicRobotsMetadata\(\)/);
  assert.match(appLayout, /PRIVATE_ROBOTS_METADATA/);
  assert.match(authLayout, /PRIVATE_ROBOTS_METADATA/);
  assert.match(middleware, /shouldSendNoIndexHeader/);
  assert.match(middleware, /X_ROBOTS_TAG_VALUE/);
  assert.doesNotMatch(nextConfig, /NEXT_PUBLIC_APP_ENV.*X-Robots-Tag/);
  assert.equal(X_ROBOTS_TAG_VALUE, "noindex, nofollow, noarchive, nosnippet");

  for (const asset of ["public/brand/favicon.svg", "public/brand/mark.svg", "public/brand/icon-192.png"]) {
    assert.equal(existsSync(new URL(`../${asset}`, import.meta.url)), true, `${asset} must remain public`);
  }

  console.log(JSON.stringify({ ok: true, suite: "public-indexing" }));
} finally {
  if (original === undefined) delete process.env.PUBLIC_INDEXING_ENABLED;
  else process.env.PUBLIC_INDEXING_ENABLED = original;
}
