import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import sharp from "sharp";

const options = parseArguments(process.argv.slice(2));
const referencePath = resolve(options.reference);
const actualPath = resolve(options.actual);
const outputDirectory = resolve(options.outdir);
const moduleName = options.module;
const moduleSlug = slugify(moduleName);

mkdirSync(outputDirectory, { recursive: true });

const [reference, actual] = await Promise.all([
  decodeImage(referencePath),
  decodeImage(actualPath),
]);

const canvasWidth = Math.max(reference.width, actual.width);
const canvasHeight = Math.max(reference.height, actual.height);
const totalPixels = canvasWidth * canvasHeight;
const referenceCanvas = padToCanvas(reference, canvasWidth, canvasHeight);
const actualCanvas = padToCanvas(actual, canvasWidth, canvasHeight);
const overlayPixels = Buffer.alloc(totalPixels * 4);
const differencePixels = Buffer.alloc(totalPixels * 4);
let changedPixels = 0;

for (let pixel = 0; pixel < totalPixels; pixel += 1) {
  const offset = pixel * 4;
  let pixelChanged = false;

  for (let channel = 0; channel < 4; channel += 1) {
    if (referenceCanvas[offset + channel] !== actualCanvas[offset + channel]) {
      pixelChanged = true;
    }
  }

  if (pixelChanged) changedPixels += 1;

  for (let channel = 0; channel < 3; channel += 1) {
    const referenceValue = compositeChannelOnWhite(
      referenceCanvas[offset + channel],
      referenceCanvas[offset + 3],
    );
    const actualValue = compositeChannelOnWhite(
      actualCanvas[offset + channel],
      actualCanvas[offset + 3],
    );
    overlayPixels[offset + channel] = Math.round((referenceValue + actualValue) / 2);
    differencePixels[offset + channel] = Math.abs(
      referenceCanvas[offset + channel] - actualCanvas[offset + channel],
    );
  }

  overlayPixels[offset + 3] = 255;
  differencePixels[offset + 3] = 255;
}

const sideBySidePath = join(outputDirectory, `${moduleSlug}-side-by-side.png`);
const overlayPath = join(outputDirectory, `${moduleSlug}-overlay-50.png`);
const differencePath = join(outputDirectory, `${moduleSlug}-absolute-diff.png`);
const reportPath = join(outputDirectory, `${moduleSlug}-exact-visual-report.json`);

const [referencePng, actualPng] = await Promise.all([
  encodeRawPng(reference),
  encodeRawPng(actual),
]);

await Promise.all([
  sharp({
    create: {
      width: canvasWidth * 2,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: referencePng, top: 0, left: 0 },
      { input: actualPng, top: 0, left: canvasWidth },
    ])
    .png()
    .toFile(sideBySidePath),
  writeRawPng(overlayPixels, canvasWidth, canvasHeight, overlayPath),
  writeRawPng(differencePixels, canvasWidth, canvasHeight, differencePath),
]);

const dimensionsEqual = reference.width === actual.width && reference.height === actual.height;
const exactMatch = dimensionsEqual && changedPixels === 0;
const report = {
  schemaVersion: 1,
  module: moduleName,
  generatedAt: new Date().toISOString(),
  reference: {
    path: portablePath(referencePath),
    file: basename(referencePath),
    width: reference.width,
    height: reference.height,
  },
  actual: {
    path: portablePath(actualPath),
    file: basename(actualPath),
    width: actual.width,
    height: actual.height,
  },
  comparison: {
    dimensionsEqual,
    changedPixels,
    totalPixels,
    changedPixelRatio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    thresholdPerChannel: 0,
    allowedChangedPixels: 0,
    exactMatch,
  },
  artifacts: {
    sideBySide: portablePath(sideBySidePath),
    overlay50: portablePath(overlayPath),
    absoluteDiff: portablePath(differencePath),
    report: portablePath(reportPath),
  },
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  module: moduleName,
  exactMatch,
  dimensionsEqual,
  changedPixels,
  totalPixels,
  report: portablePath(reportPath),
}, null, 2));

if (!exactMatch) {
  console.error(
    `ORQENA_EXACT_VISUAL_MISMATCH:${moduleSlug}:dimensionsEqual=${dimensionsEqual}:changedPixels=${changedPixels}`,
  );
  process.exitCode = 1;
}

function parseArguments(argumentsList) {
  const values = new Map();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) throw usage(`Unexpected positional argument: ${argument}`);

    const separatorIndex = argument.indexOf("=");
    const key = argument.slice(2, separatorIndex === -1 ? undefined : separatorIndex);
    const inlineValue = separatorIndex === -1 ? undefined : argument.slice(separatorIndex + 1);
    const value = inlineValue ?? argumentsList[index + 1];

    if (!value || (inlineValue === undefined && value.startsWith("--"))) {
      throw usage(`Missing value for --${key}`);
    }
    if (values.has(key)) throw usage(`Duplicate argument: --${key}`);

    values.set(key, value);
    if (inlineValue === undefined) index += 1;
  }

  const allowed = new Set(["reference", "actual", "outdir", "module"]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw usage(`Unknown argument: --${key}`);
  }
  for (const key of allowed) {
    if (!values.get(key)?.trim()) throw usage(`Required argument missing: --${key}`);
  }

  return Object.fromEntries(values);
}

function usage(message) {
  return new Error(
    `${message}\nUsage: node scripts/design/orqena-exact-visual-gate.mjs --reference <png> --actual <png> --outdir <directory> --module <name>`,
  );
}

async function decodeImage(path) {
  const { data, info } = await sharp(path)
    .rotate()
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) throw new Error(`RGBA_DECODE_REQUIRED:${path}:${info.channels}`);
  return { data, width: info.width, height: info.height };
}

function padToCanvas(image, width, height) {
  if (image.width === width && image.height === height) return image.data;

  const canvas = Buffer.alloc(width * height * 4);
  for (let row = 0; row < image.height; row += 1) {
    const sourceStart = row * image.width * 4;
    const targetStart = row * width * 4;
    image.data.copy(canvas, targetStart, sourceStart, sourceStart + image.width * 4);
  }
  return canvas;
}

function compositeChannelOnWhite(value, alpha) {
  return Math.round((value * alpha + 255 * (255 - alpha)) / 255);
}

function encodeRawPng(image) {
  return sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  }).png().toBuffer();
}

function writeRawPng(data, width, height, path) {
  return sharp(data, {
    raw: { width, height, channels: 4 },
  }).png().toFile(path);
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!slug) throw usage("--module must contain at least one letter or number");
  return slug;
}

function portablePath(path) {
  const localPath = relative(process.cwd(), path) || ".";
  return localPath.replaceAll("\\", "/");
}
