/**
 * X-CueFrame-Client: how a first-party client states its surface, version and
 * OS. Owned by the SDK because it is a wire contract between every client and
 * the API; the kernel's plane and the private server import it from here.
 */
export const CLIENT_HEADER = "X-CueFrame-Client";

export const CLIENT_SURFACES = [
  "studio",
  "web",
  "console",
  "clips",
  "cli",
  "mcp",
  "director",
] as const;
export type ClientSurface = (typeof CLIENT_SURFACES)[number];

export const CLIENT_OSES = ["macos", "windows", "linux", "browser", "unknown"] as const;
export type ClientOs = (typeof CLIENT_OSES)[number];

export interface ClientIdentity {
  surface: ClientSurface;
  version: string;
  os: ClientOs;
}

/** A version token that survives the triple: no separator, no whitespace. */
const CLIENT_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/;

/** The surfaces that only ever run in a browser, where the host OS is not ours to see. */
const BROWSER_SURFACES: readonly ClientSurface[] = ["web", "console", "clips"];

/**
 * A browser surface runs on `browser` and nothing else; a surface with a host
 * of its own never does. The header is unauthenticated, so a combination that
 * cannot occur is a planted one, and an analyst would read it as fact.
 */
export function clientPairIsPossible(surface: ClientSurface, os: ClientOs): boolean {
  return BROWSER_SURFACES.includes(surface) === (os === "browser");
}

export function formatClientHeader(client: ClientIdentity): string {
  if (!CLIENT_VERSION.test(client.version)) {
    throw new Error(
      `${CLIENT_HEADER} cannot carry the version ${JSON.stringify(client.version)}.`,
    );
  }
  if (!clientPairIsPossible(client.surface, client.os)) {
    throw new Error(`${CLIENT_HEADER} cannot carry ${client.surface} on ${client.os}.`);
  }
  return `${client.surface}/${client.version}/${client.os}`;
}

/** Null means no first-party client said so, never a guessed identity. */
export function parseClientHeader(value: string | null | undefined): ClientIdentity | null {
  if (typeof value !== "string") return null;
  const [surface, version, os, ...rest] = value.split("/");
  if (rest.length > 0 || os === undefined) return null;
  if (!(CLIENT_SURFACES as readonly string[]).includes(surface)) return null;
  if (!(CLIENT_OSES as readonly string[]).includes(os)) return null;
  if (!CLIENT_VERSION.test(version)) return null;
  if (!clientPairIsPossible(surface as ClientSurface, os as ClientOs)) return null;
  return { surface: surface as ClientSurface, version, os: os as ClientOs };
}

/** Node's `process.platform`, named in our terms. Anything else is `unknown`. */
export function osFromNodePlatform(platform: string): ClientOs {
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  if (platform === "linux") return "linux";
  return "unknown";
}

/** The host behind a webview. Unknown beats a guess in a support log. */
export function osFromUserAgent(agent: string): ClientOs {
  if (/Mac OS X|Macintosh/.test(agent)) return "macos";
  if (/Windows/.test(agent)) return "windows";
  if (/Linux|X11|CrOS/.test(agent)) return "linux";
  return "unknown";
}

/**
 * The OS a browser-hosted client reports. Only the desktop webview runs on a
 * host OS worth naming; every other browser surface is `browser`.
 */
export function clientOs(surface: ClientSurface, agent: string): ClientOs {
  return surface === "studio" ? osFromUserAgent(agent) : "browser";
}
