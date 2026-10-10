import { projects } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError } from '../remote/output.js';

interface ListOptions {
  target: 'local' | 'prod';
  limit?: number;
  json?: boolean;
}

export async function listCommand(options: ListOptions) {
  initSdk(options.target);
  emitEvent(options, 'list_prepare', { target: options.target });

  try {
    const out = await projects.listProjects();
    const limit = options.limit;
    const capped =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? out.data.slice(0, limit)
        : out.data;
    emitEvent(options, 'list_complete', {
      count: capped.length,
      total: out.data.length,
      truncated: capped.length < out.data.length,
      projects: capped,
    });
    if (!options.json) {
      if (out.data.length === 0) {
        console.log('No projects found.');
        return;
      }
      for (const p of capped) {
        const date = new Date(p.createdAt).toLocaleDateString();
        console.log(`  ${p.id}  ${p.name}  (${date})`);
      }
      if (capped.length < out.data.length) {
        console.log(`  … ${out.data.length - capped.length} more (raise --limit to see all)`);
      }
    }
  } catch (err) {
    emitError(options, 'list', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}
