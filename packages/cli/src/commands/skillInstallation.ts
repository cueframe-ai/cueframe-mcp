import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const RECEIPT = '.cueframe-install.json';
type Files = Record<string, string>;
type PackageFile = { bytes: Buffer; mode: number };
type Receipt = { version: 1; sourceHash: string; files: Files };

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Do not follow links in either bundled or installed packages. */
function readPackage(root: string): Map<string, PackageFile> {
  const files = new Map<string, PackageFile>();
  function visit(relative: string) {
    const absolute = join(root, relative);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Skill package contains a symbolic link: ${absolute}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(absolute).sort()) {
        if (!relative && name === RECEIPT) continue;
        visit(relative ? `${relative}/${name}` : name);
      }
    } else if (stat.isFile()) {
      files.set(relative, { bytes: readFileSync(absolute), mode: stat.mode & 0o777 });
    } else {
      throw new Error(`Unsupported skill package entry: ${absolute}`);
    }
  }
  visit('');
  return files;
}

function hashes(files: Map<string, PackageFile>): Files {
  return Object.fromEntries([...files].map(([name, file]) => [name, `${file.mode}:${digest(file.bytes)}`]));
}

function sameFiles(left: Files, right: Files): boolean {
  const names = Object.keys(left).sort();
  return JSON.stringify(names) === JSON.stringify(Object.keys(right).sort())
    && names.every((name) => left[name] === right[name]);
}

function managedReceipt(directory: string, files: Map<string, PackageFile>): Receipt | undefined {
  try {
    const path = join(directory, RECEIPT);
    if (!lstatSync(path).isFile()) return;
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as Receipt;
    if (receipt.version !== 1 || typeof receipt.sourceHash !== 'string' || !receipt.files
      || !sameFiles(receipt.files, hashes(files))) return;
    return receipt;
  } catch {
    return;
  }
}

function stampSkill(markdown: string, today: string): string {
  const note = `> Installed ${today} by \`npx -y cueframe install\`. Run it again to refresh\n`
    + '> unchanged managed skills. Locally edited or untracked packages are preserved;\n'
    + '> inspect reported conflicts before using `--force` (which makes a backup).\n';
  const fm = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return fm ? `${fm[0]}\n${note}${markdown.slice(fm[0].length)}` : `${note}\n${markdown}`;
}

export interface SkillInstallResult {
  installed: string[];
  unchanged: string[];
  skipped: string[];
  backups: Array<{ skill: string; path: string }>;
}

/** Purely filesystem installation: never authenticates, wires MCP, or renders. */
export function installSkillPackages(
  sourceRoot: string,
  destinationRoots: string[],
  opts: { force?: boolean; today?: string } = {},
): SkillInstallResult {
  const result: SkillInstallResult = { installed: [], unchanged: [], skipped: [], backups: [] };
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  // Read/validate all inputs before changing any installed package.
  const packages = readdirSync(sourceRoot).sort().flatMap((name) => {
    const source = join(sourceRoot, name);
    if (!existsSync(join(source, 'SKILL.md'))) return [];
    const files = readPackage(source);
    const sourceHash = digest(JSON.stringify(hashes(files)));
    const entry = files.get('SKILL.md')!;
    files.set('SKILL.md', { ...entry, bytes: Buffer.from(stampSkill(entry.bytes.toString('utf8'), today)) });
    return [{ name, files, sourceHash }];
  });
  for (const root of new Set(destinationRoots)) {
    for (const { name, files, sourceHash } of packages) {
      const destination = join(root, name);
      const skill = join(destination, 'SKILL.md');
      let present = false;
      try {
        lstatSync(destination);
        present = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (present && !opts.force) {
        let receipt: Receipt | undefined;
        try { receipt = managedReceipt(destination, readPackage(destination)); } catch { /* preserve */ }
        if (!receipt) {
          result.skipped.push(skill);
          continue;
        }
        if (receipt.sourceHash === sourceHash) {
          result.unchanged.push(skill);
          continue;
        }
      }
      // Stage first. If writing fails, the previous installed package stays intact.
      const staging = join(dirname(root), 'cueframe-skill-staging', `${name}-${randomUUID()}`);
      for (const [relative, file] of files) {
        const target = join(staging, relative);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.bytes);
        chmodSync(target, file.mode);
      }
      const receipt: Receipt = { version: 1, sourceHash, files: hashes(files) };
      writeFileSync(join(staging, RECEIPT), JSON.stringify(receipt, null, 2) + '\n');
      mkdirSync(root, { recursive: true });
      let backup: string | undefined;
      if (present) {
        backup = join(dirname(root), 'cueframe-skill-backups', `${name}-${randomUUID()}`);
        mkdirSync(dirname(backup), { recursive: true });
        renameSync(destination, backup);
      }
      try {
        renameSync(staging, destination);
      } catch (error) {
        if (backup) renameSync(backup, destination);
        throw error;
      }
      if (backup) result.backups.push({ skill, path: backup });
      result.installed.push(skill);
    }
  }
  return result;
}
