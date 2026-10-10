
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitEvent, emitResult } from '../remote/output.js';

const MANIFEST_FILENAME = 'cueframe.json';
const DEFAULT_COMPONENTS_DIR = 'cueframe/components';
const CACHE_DIR_GITIGNORE = '.cueframe/';

interface InitOpts {
  json?: boolean;
  dryRun?: boolean;
}

function ensureGitignore(cwd: string, dryRun: boolean): boolean {
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const body = readFileSync(gitignorePath, 'utf8');
    const lines = body.split('\n').map((l) => l.trim());
    if (lines.includes(CACHE_DIR_GITIGNORE) || lines.includes('.cueframe')) return false;
    if (!dryRun) {
      const sep = body.endsWith('\n') || body.length === 0 ? '' : '\n';
      writeFileSync(
        gitignorePath,
        `${body}${sep}\n# CueFrame derived render cache (regenerated; never authored)\n${CACHE_DIR_GITIGNORE}\n`,
      );
    }
    return true;
  }
  if (!dryRun) {
    writeFileSync(
      gitignorePath,
      `# CueFrame derived render cache (regenerated; never authored)\n${CACHE_DIR_GITIGNORE}\n`,
    );
  }
  return true;
}

export function initCommand(opts: InitOpts) {
  const cwd = process.cwd();
  const dryRun = opts.dryRun ?? false;
  emitEvent(opts, 'init_prepare', { cwd, dryRun });

  const manifestPath = join(cwd, MANIFEST_FILENAME);
  const manifestExisted = existsSync(manifestPath);

  let componentsDir = DEFAULT_COMPONENTS_DIR;
  if (manifestExisted) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as { componentsDir?: string };
      if (typeof parsed.componentsDir === 'string' && parsed.componentsDir.length > 0) {
        componentsDir = parsed.componentsDir;
      }
    } catch {
    }
  } else if (!dryRun) {
    writeFileSync(manifestPath, `${JSON.stringify({ componentsDir }, null, 2)}\n`);
  }

  const componentsPath = join(cwd, componentsDir);
  const componentsDirExisted = existsSync(componentsPath);
  if (!componentsDirExisted && !dryRun) mkdirSync(componentsPath, { recursive: true });

  const gitignoreChanged = ensureGitignore(cwd, dryRun);

  emitResult(
    opts,
    {
      ok: true,
      dryRun,
      root: cwd,
      manifest: { path: manifestPath, created: !manifestExisted },
      componentsDir,
      componentsDirCreated: !componentsDirExisted,
      gitignoreUpdated: gitignoreChanged,
    },
    () => {
      const verb = dryRun ? 'Would initialize' : 'Initialized';
      console.log(`✓ ${verb} CueFrame workspace at ${cwd}`);
      console.log(
        `  ${manifestExisted ? 'kept' : 'created'} ${MANIFEST_FILENAME} (componentsDir: ${componentsDir})`,
      );
      console.log(`  ${componentsDirExisted ? 'exists' : 'created'} ${componentsDir}/`);
      if (gitignoreChanged) console.log(`  gitignored ${CACHE_DIR_GITIGNORE}`);
      console.log('Next: cueframe new component <name>');
    },
  );
}
