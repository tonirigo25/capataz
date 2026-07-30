import { expect, test } from "@playwright/test";

const film = 'video[aria-label^="Orqena en acción"]';
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`35-second product film plays, pauses and leaves no overflow at ${viewport.width}px`, async ({ page, browserName }) => {
    test.setTimeout(45_000);
    await page.setViewportSize(viewport);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${browserName}:${viewport.width}`).toBe(200);

    const video = page.locator(film);
    await expect(video).toHaveAttribute("poster", "/media/marketing/orqena-video-01-poster.webp");
    await video.scrollIntoViewIfNeeded();
    await expect.poll(
      () => video.evaluate((element) => ({ paused: (element as HTMLVideoElement).paused, currentTime: (element as HTMLVideoElement).currentTime })),
      { timeout: 8_000 },
    ).toMatchObject({ paused: false });
    expect(await video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);

    const control = page.getByRole("button", { name: "Pausar vídeo de Orqena" });
    await control.click();
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await page.getByRole("button", { name: "Reproducir vídeo de Orqena" }).click();
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(false);

    await page.locator("header").first().scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused), { timeout: 4_000 }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("reduced motion keeps the film on its poster with manual playback disabled", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = page.locator(film);
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_300);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
  await expect(page.getByRole("button", { name: "Reproducir vídeo de Orqena" })).toBeDisabled();
});

test("optimized video endpoints support MIME types and byte ranges", async ({ request, browserName }) => {
  test.skip(browserName !== "chromium");
  const assets = [
    ["/media/marketing/orqena-video-01-35s.mp4", "video/mp4"],
    ["/media/marketing/orqena-video-01-35s.webm", "video/webm"],
    ["/media/marketing/orqena-video-01-poster.webp", "image/webp"],
  ] as const;
  for (const [path, contentType] of assets) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(contentType);
  }
  for (const path of assets.slice(0, 2).map(([assetPath]) => assetPath)) {
    const response = await request.get(path, { headers: { Range: "bytes=0-1023" } });
    expect(response.status(), path).toBe(206);
    expect(response.headers()["accept-ranges"], path).toBe("bytes");
    expect(response.headers()["content-range"], path).toMatch(/^bytes 0-1023\/\d+$/u);
    expect(response.headers()["content-length"], path).toBe("1024");
  }
});
