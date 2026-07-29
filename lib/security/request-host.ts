import { normalizeRequestHost } from "../host-routing";

type ExternalRequestHostInput = {
  forwardedHost: string | null | undefined;
  host: string | null | undefined;
  urlHostname: string | null | undefined;
};

export function resolveExternalRequestHost(input: ExternalRequestHostInput) {
  const candidate = input.forwardedHost?.trim()
    ? input.forwardedHost.split(",")[0]
    : input.host?.trim()
      ? input.host.split(",")[0]
      : input.urlHostname;

  return normalizeRequestHost(candidate);
}
