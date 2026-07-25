const release = process.env.NEXT_PUBLIC_RELEASE_SHA ?? "unknown";
const environment = process.env.NEXT_PUBLIC_APP_ENV ?? "unknown";

if (process.env.NODE_ENV !== "test") {
  console.info(JSON.stringify({ event: "client_observability_started", release, environment }));
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  performance.mark(`route:${navigationType}:${url.slice(0, 120)}`);
}
