import { Command, Option } from 'commander';
import {
  FormatAspectRatio,
  FormatResolution,
  RenderCreateRequestIntent,
  RenderCreateRequestPriority,
  type FormatFps,
} from '@cueframe/sdk';
import { installCommand } from './commands/install.js';
import { initCommand } from './commands/init.js';
import { newComponentCommand } from './commands/newComponent.js';
import { pushCommand, syncCommand } from './commands/push.js';
import { keysCreateCommand, keysListCommand, keysRevokeCommand } from './commands/keys.js';
import { listCommand } from './commands/list.js';
import { uploadCommand } from './commands/upload.js';
import { analyzeCommand } from './commands/analyze.js';
import { clipsCommand } from './commands/clips.js';
import { projectCreateCommand } from './commands/project.js';
import { projectDeleteCommand, mediaDeleteCommand } from './commands/destroy.js';
import { mediaDownloadUrlCommand } from './commands/media.js';
import { renderCommand } from './commands/render.js';
import { templateRunCommand, templateStatusCommand, templateValidateCommand } from './commands/template.js';
import { renderWatchCommand } from './commands/renderWatch.js';
import { loginCommand } from './commands/login.js';
import { apiCommand } from './commands/api.js';
import { compareCommand } from './commands/compare.js';
import {
  compositionGetCommand,
  compositionPutCommand,
  compositionFromSuggestionCommand,
  compositionValidateCommand,
} from './commands/composition.js';
import { schemaCommand } from './commands/schema.js';
import { exportCommand } from './commands/export.js';
import {
  sessionsListCommand,
  sessionsGetCommand,
  sessionsCreateCommand,
  sessionsDeleteCommand,
} from './commands/sessions.js';
import { describeCommand } from './commands/describe.js';
import { assertStaticApiKey, saveAuth } from './remote/auth.js';
import { ExitCode, exitCodeForError, exitWith } from './remote/exitCodes.js';
import { emitError } from './remote/output.js';
import { formatError } from './remote/sdkClient.js';


declare const __CLI_VERSION__: string;

export type Target = 'prod' | 'local';

const TARGETS: readonly Target[] = ['prod', 'local'];

function parseTarget(v: string | undefined): Target {
  if (v === undefined) return 'prod';
  if ((TARGETS as readonly string[]).includes(v)) return v as Target;
  console.error(`Invalid --target ${v}. Allowed: ${TARGETS.join(', ')}.`);
  exitWith(ExitCode.UserError);
}

function parseFps(v: string | undefined): FormatFps | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  if (n === 24 || n === 25 || n === 30 || n === 60) return n;
  console.error(`Invalid --fps ${v}. Allowed: 24, 25, 30, 60.`);
  exitWith(ExitCode.UserError);
}

const aspectOption = (description: string) =>
  new Option('-a, --aspect <ratio>', description).choices(Object.values(FormatAspectRatio));
const resolutionOption = (description: string) =>
  new Option('--resolution <r>', description).choices(Object.values(FormatResolution));

export async function main() {
  const program = new Command();

  program
    .name('cueframe')
    .description('AI-assisted video editing and rendering')
    .version(__CLI_VERSION__)
    .option('--json', 'Emit a structured JSON document on stdout instead of human-formatted output. Spinners are silenced.')
    .option('--dry-run', 'Report what would happen without mutating anything; `template run` asks the API to bind the inputs without storing a template. Applies to upload, analyze, project create, render, template run.');

  const globals = () => program.opts<{ json?: boolean; dryRun?: boolean }>();

  program
    .command('compare')
    .description('Compare an identified reference frame with an existing saved preview, without rendering the composition again.')
    .argument('<projectId>', 'Project owning the saved preview')
    .requiredOption('--reference-media <mediaId>', 'Certified reference media id')
    .requiredOption('--reference-representation <identity>', 'Exact certified representation identity')
    .requiredOption('--reference-frame <frame>', 'Zero-based frame in the certified representation')
    .requiredOption('--candidate-job <jobId>', 'Succeeded preview job id')
    .requiredOption('--candidate-artifact <artifactId>', 'Image artifact id from that job')
    .option('--views <views>', 'Comma-separated side_by_side,overlay,difference; default side_by_side,overlay')
    .option('--crop <rectangle>', 'Shared image coordinates: x,y,width,height')
    .option('-o, --out <directory>', 'Save comparison PNGs; JSON output contains compact receipts, never image bytes')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((projectId: string, opts: Omit<Parameters<typeof compareCommand>[1], 'target'> & { target?: string }) =>
      compareCommand(projectId, { ...opts, target: parseTarget(opts.target), json: globals().json }),
    );

  program
    .command('install')
    .description('One-line setup: wire the CueFrame MCP server into every installed agent (Claude Code / Cursor / Codex) and install the agent skills. No API key — auth is a browser "Allow" on first call.')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-f, --force', 'Replace locally changed or untracked skills, retaining backups')
    .action((opts: { target?: string; force?: boolean }) =>
      installCommand({
        json: globals().json,
        target: parseTarget(opts.target),
        dryRun: globals().dryRun,
        force: opts.force,
      }),
    );

  program
    .command('init')
    .description('Scaffold a CueFrame component workspace (cueframe.json + components dir) in the current repo, so `new component` has a home and the render harness can discover it.')
    .action(() => initCommand({ json: globals().json, dryRun: globals().dryRun }));

  const newCmd = program
    .command('new')
    .description('Scaffold new owned source in the component workspace');
  newCmd
    .command('component')
    .description('Scaffold a blank custom component in cueframe/components/<name>')
    .argument('<name>', 'Component id (e.g. my-badge)')
    .requiredOption('-c, --category <category>', 'Catalog category: text, effects, transitions, layouts, backgrounds, ui-blocks or scenes')
    .option('-f, --force', 'Overwrite an existing non-empty component dir')
    .action((name: string, opts: { category: string; force?: boolean }) =>
      newComponentCommand(name, { json: globals().json, dryRun: globals().dryRun, force: opts.force, category: opts.category }),
    );


  program
    .command('push')
    .description('Publish a locally-authored native component (cueframe/components/<id>/template.html + definition.json) to CueFrame so it renders server-side. Upserts by id.')
    .argument('[id]', 'Component id to push (omit and use `cueframe sync` to push all)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((id: string | undefined, opts: { target?: string }) =>
      pushCommand(id, { target: parseTarget(opts.target), json: globals().json }),
    );

  program
    .command('sync')
    .description('Publish EVERY component in the workspace (cueframe/components/*) to CueFrame. Upserts each by id.')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((opts: { target?: string }) =>
      syncCommand({ target: parseTarget(opts.target), json: globals().json }),
    );

  const keys = program
    .command('keys')
    .description('Manage API keys. `keys create` mints a scoped key — run `cueframe login` first (keys cannot mint keys).');
  keys
    .command('create')
    .description('Mint a scoped API key (cf_*). Requires a logged-in session.')
    .requiredOption('-n, --name <name>', 'Key name, e.g. ci-runner')
    .option(
      '-s, --scope <scope>',
      'Comma-separated resource:actions, e.g. media:rw,projects:rw,renders:rw (resources: media,sessions,projects,renders,webhooks; actions r/w)',
    )
    .option('--preset <preset>', 'Scope preset instead of --scope: readonly (read all) | editall (read+write all)')
    .option('--expires <days>', 'Expire after N days (default: never)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((opts: { name: string; scope?: string; preset?: string; expires?: string; target?: string }) =>
      keysCreateCommand({ ...opts, target: parseTarget(opts.target), json: globals().json }),
    );
  keys
    .command('list')
    .description('List your API keys.')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((opts: { target?: string }) =>
      keysListCommand({ target: parseTarget(opts.target), json: globals().json }),
    );
  keys
    .command('revoke')
    .description('Revoke an API key by id.')
    .argument('<keyId>', 'Key id (from `cueframe keys list`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((keyId: string, opts: { target?: string }) =>
      keysRevokeCommand(keyId, { target: parseTarget(opts.target), json: globals().json }),
    );

  program
    .command('login')
    .description('Browser-mediated sign-in (OAuth device flow). Recommended for laptops.')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('--url <url>', 'Override the API base URL (advanced)')
    .action((opts: { target?: string; url?: string }) =>
      loginCommand({ ...opts, target: parseTarget(opts.target), json: globals().json }),
    );

  program
    .command('auth')
    .description('Save a static API key (cf_live_… / cf_test_…). Use for CI / headless environments.')
    .argument('<api-key>', 'Your CueFrame API key')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('--url <url>', 'Override the API base URL (advanced)')
    .action((apiKey: string, opts: { target?: string; url?: string }) => {
      const target = parseTarget(opts.target);
      assertStaticApiKey(apiKey);
      saveAuth(apiKey, target, opts.url);
      if (globals().json) {
        console.log(JSON.stringify({ ok: true, target }, null, 2));
      } else {
        console.log(`API key saved for target "${target}"`);
      }
    });

  program
    .command('list')
    .description('List projects')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-n, --limit <n>', 'Max projects to show', '10')
    .action((opts: { target?: string; limit: string }) =>
      listCommand({
        target: parseTarget(opts.target),
        limit: parseInt(opts.limit),
        json: globals().json,
      }),
    );

  const project = program.command('project').description('Project commands');
  project
    .command('create')
    .description('Create a new project. With --from-suggestion, atomically build the composition from a clip suggestion in one round-trip — the project is then immediately renderable via `cueframe render <projectId>`.')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .addOption(aspectOption('Aspect ratio').default('9:16'))
    .option('--fps <n>', 'Frame rate: 24, 25, 30, 60', '30')
    .addOption(resolutionOption('Resolution').default('fhd'))
    .option('--brand-kit <id>', 'Bind a brand kit id to the project')
    .option('--from-suggestion <sug>', 'Clip suggestion publicId (sug_…) — atomically builds the composition after project creation so render needs no further args')
    .option('--cheap', 'With --from-suggestion: use the deterministic translator (no LLM, ~100ms) instead of the AI authoring pass. Useful for tests / programmatic flows.')
    .action(async (opts: any) => {
      await projectCreateCommand({
        name: opts.name,
        target: parseTarget(opts.target),
        aspect: opts.aspect,
        fps: parseFps(opts.fps),
        resolution: opts.resolution,
        brandKitId: opts.brandKit,
        fromSuggestion: opts.fromSuggestion,
        cheap: opts.cheap,
        json: globals().json,
        dryRun: globals().dryRun,
      });
    });
  project
    .command('delete')
    .description('Permanently delete a project (irreversible cleanup — removes the composition and render history).')
    .argument('<projectId>', 'Project ID (from `cueframe list` or `project create`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((projectId: string, opts: { target?: string }) =>
      projectDeleteCommand(projectId, { target: parseTarget(opts.target), json: globals().json }),
    );

  const media = program
    .command('media')
    .description('Media library commands');
  media
    .command('download-url')
    .description('Print a presigned download URL for a media item\'s stored source file (valid about an hour; pipe it into curl). With --json: { url, expiresAt }.')
    .argument('<mediaId>', 'Media item ID (from `cueframe clips`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((mediaId: string, opts: { target?: string }) =>
      mediaDownloadUrlCommand(mediaId, { target: parseTarget(opts.target), json: globals().json }),
    );
  media
    .command('delete')
    .description('Permanently delete a media item (irreversible cleanup — removes the source and its derived assets).')
    .argument('<mediaId>', 'Media item ID (from `cueframe clips`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((mediaId: string, opts: { target?: string }) =>
      mediaDeleteCommand(mediaId, { target: parseTarget(opts.target), json: globals().json }),
    );

  program
    .command('upload')
    .description('Upload a video file and process it')
    .argument('<file>', 'Path to video file')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-a, --analyze', 'Run clip analysis after processing completes')
    .option(
      '-r, --audio-role <role>',
      'Declare the audio role (vo|music|sfx|ambience) — routes ingest enrichment: vo→transcript, music→beat grid, sfx/ambience→envelope',
    )
    .action(async (file: string, opts: { target?: string; analyze: boolean; audioRole?: string }) => {
      await uploadCommand(file, {
        target: parseTarget(opts.target),
        analyze: opts.analyze,
        audioRole: opts.audioRole,
        json: globals().json,
        dryRun: globals().dryRun,
      });
    });

  program
    .command('analyze')
    .description('Trigger AI clip suggestion analysis for a media item')
    .argument('<mediaItemId>', 'Media item ID (from `cueframe clips`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-w, --wait', 'Wait for analysis to complete and show results')
    .action((mediaItemId: string, opts: { target?: string; wait: boolean }) =>
      analyzeCommand(mediaItemId, {
        target: parseTarget(opts.target),
        wait: opts.wait,
        json: globals().json,
        dryRun: globals().dryRun,
      }),
    );

  program
    .command('clips')
    .description('List AI-generated clip suggestions for a media item')
    .argument('[mediaItemId]', 'Media item ID (omit to list your media library)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((mediaItemId: string | undefined, opts: { target?: string }) =>
      clipsCommand(mediaItemId, {
        target: parseTarget(opts.target),
        json: globals().json,
      }),
    );

  const template = program
    .command('template')
    .description('Run or validate a CueFrame template document (.cueframe), from the public catalog or your org');
  template
    .command('run')
    .description('Start a template preparation job, wait for the ready project, and render')
    .argument('<template>', 'Catalog slug (cueframe-ai/cueframe-templates), a template id in your org, or a local .cueframe document')
    .option('-m, --media <name=source...>', 'A media parameter: name=<file|https url|sample|media:<id>> (repeatable)', [])
    .option('-v, --values <name=value...>', 'A parameter value: name=value (repeatable); coerced by the document', [])
    .option('-p, --preset <name>', 'A preset of the document; its values fill what --values leaves out')
    .option('--brand-kit <id>', 'Apply with one of your org brand kits instead of the template\'s')
    .option('--idempotency-key <key>', 'Reuse this key to safely retry a start request whose response was lost')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-o, --out <path>', 'Output MP4 path', './template-output.mp4')
    .option('--no-render', 'Create the editable project without rendering it')
    .action(async (input: string, opts: { media: string[]; values: string[]; preset?: string; brandKit?: string; idempotencyKey?: string; target?: string; out: string; render: boolean }) => {
      await templateRunCommand(input, {
        media: opts.media,
        values: opts.values,
        preset: opts.preset,
        brandKitId: opts.brandKit,
        idempotencyKey: opts.idempotencyKey,
        out: opts.out,
        target: parseTarget(opts.target),
        render: opts.render !== false,
        json: globals().json,
        dryRun: globals().dryRun,
      });
    });
  template
    .command('status')
    .description('Read a template preparation job; use --wait to reconnect until it is ready')
    .argument('<jobId>', 'Job id returned by template run')
    .option('--wait', 'Poll until ready, failed, or cancelled')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action(async (jobId: string, opts: { wait?: boolean; target?: string }) => {
      await templateStatusCommand(jobId, { target: parseTarget(opts.target), json: globals().json, wait: opts.wait });
    });
  template
    .command('validate')
    .description('Check a template document: its references, every preset bound with the sample media, its prepared mattes. Runs on the CueFrame API with your key; nothing is stored.')
    .argument('<template>', 'Catalog slug, a template id in your org, or a local .cueframe document')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action(async (input: string, opts: { target?: string }) => {
      await templateValidateCommand(input, { target: parseTarget(opts.target), json: globals().json });
    });

  const render = program
    .command('render')
    .description('Render a project to MP4 (queues, watches via SSE, downloads). Renders whatever composition is saved on the project — build it first via `project create --from-suggestion` or `composition from-suggestion`.')
    .allowExcessArguments(false)
    .argument('<projectId>', 'Project ID (from `cueframe list` or `project create`)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .addOption(aspectOption("Format override; must match the composition's aspect (a new aspect is `derive_composition`). Default: the composition's format"))
    .option('--fps <n>', 'Frame rate (24, 25, 30, 60); needs --aspect. A saved composition keeps its own fps')
    .addOption(resolutionOption('Output resolution override; needs --aspect. Default: the composition\'s resolution'))
    .option('-o, --out <path>', 'Output file path (default: ./reel-<id>.mp4)')
    .option(
      '--idempotency-key <key>',
      'Override the auto-derived Idempotency-Key. Default: sha256 of the project, the current composition ETag and the request body (format, priority, intent). Pass a fresh UUID to force a new render row.',
    )
    .addOption(
      new Option(
        '--priority <p>',
        'Routing intent: interactive (low-latency, access-gated), standard (default), background (lowest queue weight).',
      ).choices(Object.values(RenderCreateRequestPriority)),
    )
    .addOption(
      new Option(
        '--intent <i>',
        'Encode-quality hint: preview (fast / low-bitrate, for editor scrubbing) or final (default, full Format).',
      ).choices(Object.values(RenderCreateRequestIntent)),
    )
    .action(async (projectId: string, opts: any) => {
      await renderCommand(projectId, {
        target: opts.target,
        aspect: opts.aspect,
        fps: parseFps(opts.fps),
        resolution: opts.resolution,
        out: opts.out,
        json: globals().json,
        dryRun: globals().dryRun,
        ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
        ...(opts.priority ? { priority: opts.priority } : {}),
        ...(opts.intent ? { intent: opts.intent } : {}),
      });
    });

  program
    .command('api')
    .description('Raw API call against the v1 surface (escape hatch — like `gh api`).')
    .argument('<method>', 'HTTP method: GET, POST, PUT, PATCH, DELETE')
    .argument('<path>', 'API path starting with /v1, e.g. /v1/projects')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-b, --body <body>', 'Request body (inline JSON, @file.json to read from disk, @- for stdin)')
    .option('-H, --header <header...>', 'Additional header (repeatable), e.g. -H "If-Match: \\"abc\\""')
    .option('-i, --include', 'Include response status line + headers in stdout (curl-style). Lets agents read ETag etc.')
    .option('--timeout-ms <milliseconds>', 'Request timeout in milliseconds (1–2147483647); omitted uses the SDK default. Does not change server deadlines.')
    .action((method: string, path: string, opts: any) =>
      apiCommand(method, path, {
        target: opts.target,
        body: opts.body,
        header: opts.header,
        include: opts.include,
        timeoutMs: opts.timeoutMs,
        json: globals().json,
      }),
    );

  program
    .command('schema')
    .description('Print the live composition wire schema from the server (/v1/openapi.json) — discover the contract instead of guessing.')
    .argument('[resource]', 'Schema to print (currently: composition)', 'composition')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((resource: string, opts: { target: string }) =>
      schemaCommand(resource, { target: opts.target, json: globals().json }),
    );

  const composition = program
    .command('composition')
    .description("Read/write a project's composition. ETag is threaded automatically.");
  composition
    .command('validate')
    .description('Validate a composition body against the live schema WITHOUT saving or rendering. Returns per-field errors — author safely before paying for a render.')
    .requiredOption('-b, --body <body>', 'Composition JSON (inline, @file.json, or @- for stdin)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action(async (opts: { body: string; target: string }) => {
      await compositionValidateCommand({ target: opts.target, body: opts.body, json: globals().json });
    });
  composition
    .command('get')
    .description("Fetch the project's composition and ETag")
    .argument('<projectId>', 'Project ID')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((projectId: string, opts: { target: string }) =>
      compositionGetCommand(projectId, { target: opts.target, json: globals().json }),
    );
  composition
    .command('put')
    .description('Replace the composition. Requires --if-match <etag> from `composition get` (or --create for a project with none), so a newer save is never silently overwritten.')
    .argument('<projectId>', 'Project ID')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .requiredOption('-b, --body <body>', 'Composition JSON (inline, @file.json, or @- for stdin)')
    .option('--if-match <etag>', 'ETag of the version your edit is based on (from `composition get`); a newer save fails with 409 stale_etag')
    .option('--create', 'Create the first composition of a project that has none (If-None-Match: *); refused 409 if one exists')
    .action(async (projectId: string, opts: any) => {
      await compositionPutCommand(projectId, {
        target: opts.target,
        body: opts.body,
        ifMatch: opts.ifMatch,
        create: opts.create,
        json: globals().json,
      });
    });
  composition
    .command('from-suggestion')
    .description('Build the composition from an existing clip suggestion')
    .argument('<projectId>', 'Project ID')
    .requiredOption('-s, --suggestion <suggestionId>', 'Clip suggestion publicId (sug_…)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('--format <json>', 'Optional format override, e.g. \'{"aspectRatio":"9:16","fps":30,"resolution":"fhd"}\'')
    .option('--if-match <etag>', 'Use this ETag (skip the GET round-trip)')
    .action((projectId: string, opts: any) =>
      compositionFromSuggestionCommand(projectId, {
        target: opts.target,
        suggestionId: opts.suggestion,
        format: opts.format,
        ifMatch: opts.ifMatch,
        json: globals().json,
      }),
    );

  render
    .command('watch')
    .description('Reattach to an existing render and stream progress to terminal state')
    .argument('<renderId>', 'Render ID (from `cueframe render` output)')
    .requiredOption('-p, --project <projectId>', 'Project the render belongs to')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('--no-download', 'Print the MP4 URL but skip downloading the file')
    .option('-o, --out <path>', 'Output file path when downloading (default: ./reel-<id>.mp4)')
    .action((renderId: string, opts: any, cmd: any) => {
      const target =
        (cmd?.parent?.opts?.()?.target as string | undefined) ?? opts.target;
      return renderWatchCommand(renderId, {
        target,
        project: opts.project,
        out: opts.out,
        download: opts.download !== false,
        json: globals().json,
      });
    });


  const exportCmd = program
    .command('export')
    .description('Hand the timeline off to a real NLE (Final Cut Pro / Premiere Pro)');
  exportCmd
    .command('fcpxml')
    .description('Build a Final Cut Pro export zip and (optionally) wait to download it')
    .argument('<projectId>', 'Project ID')
    .requiredOption('-s, --suggestion <suggestionId>', 'Clip suggestion publicId (sug_…)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-o, --out <path>', 'Output zip path (default: ./export-<id>.zip)')
    .option('--wait', 'Block until the export finishes, then download the artifact')
    .action((projectId: string, opts: any) =>
      exportCommand('fcpxml', {
        target: opts.target,
        projectId,
        suggestionId: opts.suggestion,
        out: opts.out,
        wait: opts.wait,
        json: globals().json,
      }),
    );
  exportCmd
    .command('premiere')
    .description('Build a Premiere Pro export zip and (optionally) wait to download it')
    .argument('<projectId>', 'Project ID')
    .requiredOption('-s, --suggestion <suggestionId>', 'Clip suggestion publicId (sug_…)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .option('-o, --out <path>', 'Output zip path (default: ./export-<id>.zip)')
    .option('--wait', 'Block until the export finishes, then download the artifact')
    .action((projectId: string, opts: any) =>
      exportCommand('premiere', {
        target: opts.target,
        projectId,
        suggestionId: opts.suggestion,
        out: opts.out,
        wait: opts.wait,
        json: globals().json,
      }),
    );

  const sessions = program
    .command('sessions')
    .description('Multi-file ingest sessions (camera A/B/screen → muxed composition)');
  sessions
    .command('list')
    .description('List sessions in this org')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((opts: { target: string }) =>
      sessionsListCommand({ target: opts.target, json: globals().json }),
    );
  sessions
    .command('get')
    .description('Get a single session by ID')
    .argument('<sessionId>', 'Session ID')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((sessionId: string, opts: { target: string }) =>
      sessionsGetCommand(sessionId, { target: opts.target, json: globals().json }),
    );
  sessions
    .command('create')
    .description('Create a session from one or more media files')
    .requiredOption('-n, --name <name>', 'Session name')
    .requiredOption('-f, --file <entry...>', 'Each entry is <mediaId>:<role> (repeatable)')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((opts: any) =>
      sessionsCreateCommand({
        target: opts.target,
        name: opts.name,
        files: opts.file,
        json: globals().json,
      }),
    );
  sessions
    .command('delete')
    .description('Delete a session (server checks for compositions referencing it)')
    .argument('<sessionId>', 'Session ID')
    .option('-t, --target <target>', 'Target environment: prod (default), local. CUEFRAME_API_URL overrides the host.')
    .action((sessionId: string, opts: { target: string }) =>
      sessionsDeleteCommand(sessionId, { target: opts.target, json: globals().json }),
    );

  program
    .command('describe')
    .description('Print the CLI command tree as structured JSON (agent introspection)')
    .action(() => describeCommand(program, { json: globals().json }));


  try {
    await program.parseAsync();
  } catch (err) {
    const code = exitCodeForError(err);
    emitError(
      globals(),
      'cli',
      Object.assign(new Error(formatError(err)), {
        code: (err as { code?: unknown })?.code,
        status: (err as { status?: unknown })?.status,
      }),
      code,
    );
    exitWith(code);
  }
}
