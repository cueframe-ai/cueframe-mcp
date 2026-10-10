import { describe, it, expect } from "vitest";
import {
  CLIENT_HEADER,
  CLIENT_OSES,
  CLIENT_SURFACES,
  clientOs,
  clientPairIsPossible,
  formatClientHeader,
  osFromNodePlatform,
  osFromUserAgent,
  parseClientHeader,
  type ClientIdentity,
} from "./clientIdentity";

const STUDIO: ClientIdentity = { surface: "studio", version: "0.1.13", os: "macos" };

describe("the client header", () => {
  it("is one name both halves import", () => {
    expect(CLIENT_HEADER).toBe("X-CueFrame-Client");
  });

  it("writes surface/version/os", () => {
    expect(formatClientHeader(STUDIO)).toBe("studio/0.1.13/macos");
    expect(formatClientHeader({ surface: "cli", version: "0.4.6", os: "linux" })).toBe(
      "cli/0.4.6/linux",
    );
    expect(formatClientHeader({ surface: "console", version: "dev", os: "browser" })).toBe(
      "console/dev/browser",
    );
  });

  it("round trips every surface and os that can occur together", () => {
    for (const surface of CLIENT_SURFACES) {
      for (const os of CLIENT_OSES) {
        if (!clientPairIsPossible(surface, os)) continue;
        const client: ClientIdentity = { surface, version: "1.2.3-rc.4", os };
        expect(parseClientHeader(formatClientHeader(client))).toEqual(client);
      }
    }
  });

  it("refuses a version that would break the triple", () => {
    expect(() => formatClientHeader({ ...STUDIO, version: "0.1/13" })).toThrow();
    expect(() => formatClientHeader({ ...STUDIO, version: "" })).toThrow();
    expect(() => formatClientHeader({ ...STUDIO, version: "a b" })).toThrow();
  });

  it("reads an absent, malformed or unknown value as no client", () => {
    expect(parseClientHeader(null)).toBeNull();
    expect(parseClientHeader(undefined)).toBeNull();
    expect(parseClientHeader("")).toBeNull();
    expect(parseClientHeader("studio/0.1.13")).toBeNull();
    expect(parseClientHeader("studio/0.1.13/macos/extra")).toBeNull();
    expect(parseClientHeader("curl/8.7.1/macos")).toBeNull();
    expect(parseClientHeader("studio/0.1.13/haiku")).toBeNull();
    expect(parseClientHeader("mcp/0.1.0/unknown")).toEqual({
      surface: "mcp",
      version: "0.1.0",
      os: "unknown",
    });
    expect(parseClientHeader("studio//macos")).toBeNull();
  });
});

describe("naming the OS", () => {
  it("maps the three platforms Node reports for the hosts we ship", () => {
    expect(osFromNodePlatform("darwin")).toBe("macos");
    expect(osFromNodePlatform("win32")).toBe("windows");
    expect(osFromNodePlatform("linux")).toBe("linux");
  });

  it("says unknown for a platform we do not ship, rather than guessing one", () => {
    expect(osFromNodePlatform("freebsd")).toBe("unknown");
    expect(osFromNodePlatform("aix")).toBe("unknown");
    expect(osFromNodePlatform("")).toBe("unknown");
  });

  it("reads the host out of a webview agent", () => {
    expect(osFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
    expect(osFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120")).toBe("windows");
    expect(osFromUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });

  it("says unknown for an agent it does not recognise", () => {
    expect(osFromUserAgent("some-http-client/1.0")).toBe("unknown");
    expect(osFromUserAgent("")).toBe("unknown");
  });
});

describe("pairs that cannot happen", () => {
  const cases: Array<[string, boolean]> = [
    ["web/1.0.0/browser", true],
    ["console/1.0.0/browser", true],
    ["clips/1.0.0/browser", true],
    ["studio/1.0.0/macos", true],
    ["studio/1.0.0/unknown", true],
    ["cli/1.0.0/linux", true],
    ["mcp/1.0.0/windows", true],
    ["director/1.0.0/linux", true],
    ["web/1.0.0/macos", false],
    ["console/1.0.0/linux", false],
    ["clips/1.0.0/windows", false],
    ["studio/1.0.0/browser", false],
    ["cli/1.0.0/browser", false],
    ["mcp/1.0.0/browser", false],
    ["director/1.0.0/browser", false],
  ];

  it.each(cases)("%s is a client we could have written: %s", (value, possible) => {
    expect(parseClientHeader(value) !== null).toBe(possible);
  });

  it("refuses to write a pair it would refuse to read", () => {
    expect(() => formatClientHeader({ surface: "cli", version: "1.0.0", os: "browser" })).toThrow();
    expect(() => formatClientHeader({ surface: "web", version: "1.0.0", os: "macos" })).toThrow();
  });

  it("names the browser OS for every browser surface and the host for the desktop", () => {
    expect(clientOs("web", "Mozilla/5.0 (Macintosh)")).toBe("browser");
    expect(clientOs("console", "Mozilla/5.0 (Macintosh)")).toBe("browser");
    expect(clientOs("studio", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
  });
});
