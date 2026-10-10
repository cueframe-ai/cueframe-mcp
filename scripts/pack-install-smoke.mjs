#!/usr/bin/env node
// Pack the four publishable packages and install the tarballs into an empty consumer, then assert
// what a user who runs `npm install @cueframe/api-contract @cueframe/sdk @cueframe/skills cueframe` would see.
// The workspace exports point at TypeScript source and `publishConfig` swaps them for dist at
// pack time, so this is the only check that exercises the published entry points. CI runs it
// after `pnpm build`; locally it builds first when a dist directory is missing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["packages/api-contract", "packages/sdk", "packages/skills", "packages/cli"];
const EXPECTED_SKILLS = 18;

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });

const failures = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    console.log(`ok   ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
};

if (PACKAGES.some((p) => !existsSync(resolve(ROOT, p, "dist")))) {
  console.log("dist missing in a package; running pnpm build");
  run("pnpm", ["build"], { cwd: ROOT, stdio: "inherit" });
}

// realpath: macOS hands out /var/... which is a symlink to /private/var/...; npm records the
// resolved path in package-lock.json, so compare against the resolved form.
const dir = realpathSync(mkdtempSync(join(tmpdir(), "cf-pack-smoke-")));
try {
  for (const p of PACKAGES) {
    run("pnpm", ["pack", "--pack-destination", dir], { cwd: resolve(ROOT, p) });
  }
  const tgzs = readdirSync(dir).filter((f) => f.endsWith(".tgz")).sort();
  if (tgzs.length !== PACKAGES.length) {
    throw new Error(`expected ${PACKAGES.length} tarballs, got ${tgzs.length}: ${tgzs.join(", ")}`);
  }
  console.log(`packed ${tgzs.join(", ")}`);

  run("npm", ["init", "-y"], { cwd: dir, stdio: "ignore" });
  run("npm", ["install", "--no-audit", "--no-fund", ...tgzs.map((f) => `./${f}`)], { cwd: dir, stdio: "inherit" });

  // Every @cueframe package must have come from a tarball, not the registry. No package here depends
  // on another at runtime today (the CLI bundles the SDK at build time), but if one ever does, npm
  // would silently fetch a registry copy into a nested node_modules when the tarball did not satisfy
  // the range; this keeps that failure visible.
  check("every @cueframe package resolved from a local tarball", () => {
    const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
    const entries = Object.entries(lock.packages ?? {}).filter(([k]) => /(^|\/)node_modules\/(@cueframe\/[^/]+|cueframe)$/.test(k));
    if (entries.length !== PACKAGES.length) {
      throw new Error(`expected ${PACKAGES.length} @cueframe lock entries, found ${entries.length}: ${entries.map(([k]) => k).join(", ")}`);
    }
    for (const [key, entry] of entries) {
      if (key.split("node_modules/").length !== 2) throw new Error(`${key} is nested`);
      if (!String(entry.resolved ?? "").startsWith("file:")) throw new Error(`${key} resolved from ${entry.resolved}`);
    }
    return entries.map(([k]) => k.replace("node_modules/", "")).join(", ");
  });

  const nodeEval = (code, type = "module") =>
    run(process.execPath, [`--input-type=${type}`, "-e", code], { cwd: dir }).trim();

  check("@cueframe/sdk resolves", () => nodeEval(`await import("@cueframe/sdk"); console.log("resolved");`));
  check("@cueframe/sdk/client-identity exports CLIENT_HEADER", () =>
    nodeEval(`const m = await import("@cueframe/sdk/client-identity"); if (m.CLIENT_HEADER !== "X-CueFrame-Client") throw new Error("CLIENT_HEADER=" + m.CLIENT_HEADER); console.log(m.CLIENT_HEADER);`));
  check("@cueframe/api-contract/openapi.json is Apache-2.0", () =>
    nodeEval(`const s = JSON.parse(require("fs").readFileSync(require.resolve("@cueframe/api-contract/openapi.json"), "utf8")); if (s.info.license.identifier !== "Apache-2.0") throw new Error("license=" + JSON.stringify(s.info.license)); console.log(s.info.license.identifier);`, "commonjs"));
  // `./package.json` is exported so a consumer can locate the installed package and read its version
  // (the application repository's contract-pin check does); the stamped contractVersion must equal it.
  check("@cueframe/api-contract reports one contractVersion everywhere, equal to its package version", () =>
    nodeEval(`import { createRequire } from "node:module"; const require = createRequire(import.meta.url); const r = (p) => JSON.parse(require("fs").readFileSync(require.resolve(p), "utf8")); const pkg = r("@cueframe/api-contract/package.json").version; const { contractVersion } = await import("@cueframe/api-contract"); const seen = [r("@cueframe/api-contract/contract-manifest.json").contractVersion, r("@cueframe/api-contract/manifest.json").contractVersion, contractVersion]; if (seen.some((v) => v !== pkg)) throw new Error("package " + pkg + " vs " + JSON.stringify(seen)); console.log(pkg);`));
  // The application repository's MCP tool generator keys each operation's request body on the camelCase
  // `<operationId>Body` export of @cueframe/sdk/zod, and the server resolves that key from the same module
  // at runtime. The published module must therefore export exactly the set the generated sources declare;
  // that is why the SDK ships no zod sources (one contract chain, 2026-10-07).
  check("@cueframe/sdk/zod exports every request-body schema the generated zod sources declare", () => {
    const expected = new Set();
    const zodRoot = resolve(ROOT, "packages/sdk/src/generated/zod");
    for (const tag of readdirSync(zodRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
      let src;
      try { src = readFileSync(join(zodRoot, tag, `${tag}.ts`), "utf8"); } catch { continue; }
      for (const m of src.matchAll(/export const ([A-Za-z0-9_]+Body)\b/g)) expected.add(m[1][0].toLowerCase() + m[1].slice(1));
    }
    const published = JSON.parse(nodeEval(`const m = await import("@cueframe/sdk/zod"); console.log(JSON.stringify(Object.keys(m).filter((k) => /^[a-z].*Body$/.test(k)).sort()));`));
    const missing = [...expected].filter((k) => !published.includes(k));
    const extra = published.filter((k) => !expected.has(k));
    if (expected.size === 0 || missing.length || extra.length) throw new Error(`expected ${expected.size}; missing ${JSON.stringify(missing)}; extra ${JSON.stringify(extra)}`);
    return `${published.length} *Body exports`;
  });
  // The skills package is a copy of the repository's root skills/ tree: same skill names, byte-identical
  // SKILL.md files, and the typed `SKILLS_DIR` export points inside the installed package.
  check("@cueframe/skills/dir lists the root skills with byte-identical SKILL.md files", () => {
    const rootSkills = resolve(ROOT, "skills");
    const want = readdirSync(rootSkills, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const installed = nodeEval(`const { SKILLS_DIR } = await import("@cueframe/skills/dir"); console.log(SKILLS_DIR);`);
    if (!installed.startsWith(join(dir, "node_modules/@cueframe/skills/"))) throw new Error(`SKILLS_DIR=${installed}`);
    const have = readdirSync(installed, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    if (JSON.stringify(have) !== JSON.stringify(want) || want.length !== EXPECTED_SKILLS) throw new Error(`installed ${JSON.stringify(have)} vs root ${JSON.stringify(want)}`);
    for (const name of want) {
      if (!readFileSync(join(rootSkills, name, "SKILL.md")).equals(readFileSync(join(installed, name, "SKILL.md")))) throw new Error(`${name}/SKILL.md differs`);
    }
    if (!existsSync(join(dir, "node_modules/@cueframe/skills/skills-dir.d.ts"))) throw new Error("skills-dir.d.ts not shipped");
    return `${have.length} skills`;
  });
  check("npx --no-install cueframe --help mentions install", () => {
    const help = run("npx", ["--no-install", "cueframe", "--help"], { cwd: dir });
    if (!help.includes("install")) throw new Error(`--help output lacks "install": ${help.slice(0, 200)}`);
    return `${help.split("\n").length} lines`;
  });
  check(`cueframe ships ${EXPECTED_SKILLS} skills`, () => {
    const skills = readdirSync(join(dir, "node_modules/cueframe/dist/skills"), { withFileTypes: true }).filter((d) => d.isDirectory());
    if (skills.length !== EXPECTED_SKILLS) throw new Error(`found ${skills.length}: ${skills.map((d) => d.name).join(", ")}`);
    return `${skills.length} skills`;
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`smoke failed: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("smoke ok");
