#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function filesUnder(directory) {
  const result = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) result.push(...filesUnder(path));
    else if (path.endsWith(".ts")) result.push(path);
  }
  return result;
}

for (const path of filesUnder(join(root, "packages", "sdk", "src", "generated"))) {
  const source = readFileSync(path, "utf8");
  const generated = source;
  const normalized = `${generated.replace(/[ \t]+$/gm, "").trimEnd()}\n`;
  if (normalized !== source) writeFileSync(path, normalized, "utf8");
}
