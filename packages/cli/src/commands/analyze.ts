import { clips } from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitErrorJson, spinner as oraSpinner } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export async function analyzeCommand(
  mediaItemId: string,
  opts: { target: string; wait: boolean; json?: boolean; dryRun?: boolean },
) {
  assertCleanIdentifier(mediaItemId, 'mediaItemId', opts);

  if (opts.dryRun) {
    emitEvent(opts, 'analyze_dry_run', {
      mediaItemId,
      target: opts.target,
      wait: !!opts.wait,
      wouldCall: 'POST /v1/media/:id/suggestions',
    });
    if (!opts.json) {
      console.log(`[dry-run] Would trigger clip analysis for ${mediaItemId} on ${opts.target}.`);
    }
    return;
  }

  initSdk(opts.target);

  emitEvent(opts, 'analyze_prepare', {
    mediaItemId,
    target: opts.target,
    wait: !!opts.wait,
  });

  const spinner = oraSpinner('Triggering clip analysis…', opts.json);
  let trigger: { status: string; alreadyRunning?: boolean };

  try {
    trigger = await clips.suggestBriefs(mediaItemId);
    spinner.succeed(`Analysis ${trigger.alreadyRunning ? 'already running' : 'started'}`);
  } catch (err) {
    spinner.fail(`Failed to start analysis: ${formatError(err)}`);
    emitErrorJson(opts, 'analyze_prepare', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  emitEvent(opts, 'analyze_ready', {
    mediaItemId,
    status: trigger.status,
    alreadyRunning: !!trigger.alreadyRunning,
  });

  if (!opts.wait) {
    if (!opts.json) {
      console.log(`\nRun \`cueframe clips ${mediaItemId}\` to check results.`);
    }
    return;
  }

  const poll = oraSpinner('Waiting for analysis to complete…', opts.json);
  const start = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    if (Date.now() - start > POLL_TIMEOUT_MS) {
      poll.fail(`Timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s. Run \`cueframe clips ${mediaItemId}\` to check later.`);
      emitErrorJson(
        opts,
        'analyze_progress',
        new Error(`Analysis did not complete within ${Math.round(POLL_TIMEOUT_MS / 1000)}s`),
        ExitCode.UserError,
      );
      exitWith(ExitCode.UserError);
    }

    try {
      const result = await clips.listMediaSuggestions(mediaItemId);
      if (result.suggestions.length > 0) {
        poll.succeed(`Analysis complete — ${result.suggestions.length} clips found`);
        emitEvent(opts, 'analyze_complete', {
          mediaItemId,
          durationMs: Date.now() - start,
          suggestionCount: result.suggestions.length,
          suggestions: result.suggestions,
        });
        if (!opts.json) {
          result.suggestions.forEach((s, i: number) => {
            const dur = (s.trim.end - s.trim.start).toFixed(1);
            console.log(`\n  ${i + 1}. ${s.title} (${s.id})`);
            console.log(`     ${s.trim.start.toFixed(1)}s – ${s.trim.end.toFixed(1)}s  (${dur}s)  score: ${s.score}`);
            console.log(`     ${s.reason}`);
          });
        }
        return;
      }
      const elapsed = Math.round((Date.now() - start) / 1000);
      poll.text = `Waiting for analysis… (${elapsed}s)`;
      emitEvent(opts, 'analyze_progress', { mediaItemId, elapsedSec: elapsed });
    } catch {
    }
  }
}
