module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready|started server",
      startServerReadyTimeout: 120000,
      url: [
        "http://127.0.0.1:3210/",
        "http://127.0.0.1:3210/producto",
        "http://127.0.0.1:3210/demo",
        "http://127.0.0.1:3210/precios",
        "http://127.0.0.1:3210/recursos",
        "http://127.0.0.1:3210/empresa",
        "http://127.0.0.1:3210/contacto"
      ],
      numberOfRuns: 1,
      settings: {
        port: Number(process.env.LIGHTHOUSE_CHROME_PORT || 0),
        hostname: "127.0.0.1",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 2,
        },
      }
    },
    assert: {
      assertions: {
        // Review is intentionally noindex, so Lighthouse records SEO without gating its aggregate score.
        "categories:performance": ["error", { "minScore": 0.7 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    upload: { target: "filesystem", outputDir: "artifacts/lighthouse" }
  }
};
