const requiredNames = [
  "APP_BASE_URL",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "DATABASE_URL",
  "CRON_SECRET",
  "PROACTIVE_CRON_SECRET",
];

const presence = Object.fromEntries(requiredNames.map((name) => [name, Boolean(process.env[name])]));
console.log(JSON.stringify({
  mode: "names-and-presence-only",
  targetChecks: {
    productionEnvironment: process.env.RAILWAY_ENVIRONMENT_NAME === "production",
    expectedProject: process.env.RAILWAY_PROJECT_ID === "ca7ec244-e961-42dc-8573-23835e6db5f5",
    applicationService: process.env.RAILWAY_SERVICE_NAME === "capataz",
  },
  presence,
  sessionSecretRequiredByApplication: false,
}, null, 2));
