import { projects, type FormatAspectRatio, type FormatFps, type FormatResolution } from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitErrorJson, spinner as oraSpinner } from '../remote/output.js';
import { compositionFromSuggestionCommand } from './composition.js';

export async function projectCreateCommand(opts: {
  name: string;
  target: string;
  aspect?: FormatAspectRatio;
  fps?: FormatFps;
  resolution?: FormatResolution;
  brandKitId?: string;
  fromSuggestion?: string;
  cheap?: boolean;
  json?: boolean;
  dryRun?: boolean;
}) {
  const format = opts.aspect
    ? { aspectRatio: opts.aspect, fps: opts.fps ?? 30, resolution: opts.resolution ?? 'fhd' }
    : undefined;

  if (opts.dryRun) {
    emitEvent(opts, 'project_create_dry_run', {
      name: opts.name,
      target: opts.target,
      format: format ?? null,
      brandKitId: opts.brandKitId ?? null,
      fromSuggestion: opts.fromSuggestion ?? null,
      cheap: opts.cheap ?? false,
      wouldCall: opts.fromSuggestion
        ? opts.cheap
          ? 'POST /v1/projects → POST /v1/projects/:id/composition/from-suggestion (sync translator)'
          : 'POST /v1/projects → POST /v1/projects/:id/compose (async) → SSE watch'
        : 'POST /v1/projects',
    });
    if (!opts.json) {
      const tier = opts.cheap ? ' (--cheap: deterministic translator)' : '';
      console.log(
        `[dry-run] Would create project "${opts.name}" on ${opts.target}` +
          (opts.fromSuggestion ? ` from suggestion ${opts.fromSuggestion}${tier}.` : '.'),
      );
    }
    return;
  }

  initSdk(opts.target);
  emitEvent(opts, 'project_create_prepare', {
    name: opts.name,
    target: opts.target,
    fromSuggestion: opts.fromSuggestion ?? null,
    brandKitId: opts.brandKitId ?? null,
    cheap: opts.cheap ?? false,
  });
  const spinner = oraSpinner(`Creating project "${opts.name}"…`, opts.json);
  let project: Awaited<ReturnType<typeof projects.createProject>>;
  try {
    project = await projects.createProject({
      name: opts.name,
      format,
      brandKitId: opts.brandKitId,
    });
    spinner.succeed(`Created: ${project.id}`);
  } catch (err) {
    spinner.fail(`Failed: ${formatError(err)}`);
    emitErrorJson(opts, 'project_create', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  emitEvent(opts, 'project_create_complete', { project });
  if (!opts.json && !opts.fromSuggestion) {
    console.log(`\n  ${project.id}  ${project.name}`);
  }

  if (opts.fromSuggestion) {
    let composed = false;
    if (!composed) {
      await compositionFromSuggestionCommand(project.id, {
        target: opts.target,
        suggestionId: opts.fromSuggestion,
        json: opts.json,
      });
    }
    if (!opts.json) {
      const tier = composed ? '(composed)' : '(translated)';
      console.log(`\n  ${project.id}  ${project.name}  ← composed from ${opts.fromSuggestion} ${tier}`);
    }
  }

  return project;
}
