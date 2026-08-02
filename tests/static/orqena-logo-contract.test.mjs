import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function source(path) {
  return readFileSync(join(root, path), "utf8");
}

test("el sistema compartido usa el símbolo oficial que ya sirve Production", () => {
  const brandMark = source("components/brand/brand-mark.tsx");

  assert.match(brandMark, /orqena-simbolo-oficial\.png/);
  assert.doesNotMatch(brandMark, /orqena-simbolo-oficial-v2\.png/);
});

test("el login reutiliza el sistema de marca y no activos alternativos", () => {
  const login = source("components/auth/login-shell.tsx");

  assert.match(login, /<BrandLockup inverse compact \/>/);
  assert.match(login, /<BrandMark size="lg" \/>/);
  assert.doesNotMatch(login, /orqena-logo-oficial-sobre-oscuro/);
  assert.doesNotMatch(login, /orqena-simbolo-oficial-v2/);
});

test("las superficies principales comparten BrandLogo o BrandMark", () => {
  const surfaces = [
    "components/app-chrome.tsx",
    "app/marketing-v2/_components/marketing-header.tsx",
    "app/marketing-v2/_components/hero-demo.tsx",
    "app/not-found.tsx",
  ];

  for (const path of surfaces) {
    const content = source(path);
    assert.match(content, /Brand(?:Logo|Mark|Lockup)/, `${path} debe reutilizar el sistema de marca`);
    assert.doesNotMatch(content, /orqena-(?:logo-oficial-sobre-oscuro|simbolo-oficial-v2)/, `${path} no debe fijar una variante obsoleta`);
  }
});

test("el lockup inverso conserva la misma arquitectura que Production", () => {
  const brandMark = source("components/brand/brand-mark.tsx");

  assert.match(brandMark, /inverse && "brand-lockup--inverse"/);
  assert.match(brandMark, /brand-lockup__tile/);
  assert.match(brandMark, /brand-lockup__name/);
  assert.doesNotMatch(brandMark, /if \(inverse\)[\s\S]*variant="sidebar"/);
});

test("el símbolo móvil conserva contraste y no se apoya en un fondo verde", () => {
  const chrome = source("components/app-chrome.tsx");

  assert.match(chrome, /field-os-mobile-brand[^\n]+border border-border bg-surface/);
  assert.doesNotMatch(chrome, /field-os-mobile-brand[^\n]+bg-brand(?:\s|\")/);
});

test("el logo del formulario conserva las medidas de Production también en móvil", () => {
  const css = source("components/auth/auth-shell.module.css");

  assert.match(css, /\.formBrand \{ width: 5rem; height: 5rem; border-radius: 1\.25rem; \}/);
  assert.match(css, /\.formBrand > :global\(\.brand-logo\) \{ width: 3rem; height: 3rem; \}/);
});
