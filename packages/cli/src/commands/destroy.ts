
import { projects as projectsSdk, media as mediaSdk } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitResult } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

interface CommonOpts {
  target: string;
  json?: boolean;
}


export async function projectDeleteCommand(projectId: string, opts: CommonOpts) {
  assertCleanIdentifier(projectId, 'projectId', opts);
  initSdk(opts.target);
  emitEvent(opts, 'project_delete_prepare', { projectId });
  try {
    await projectsSdk.deleteProject(projectId);
    emitEvent(opts, 'project_delete_complete', { projectId });
    emitResult(opts, { ok: true, projectId }, () => {
      console.log(`Project ${projectId} deleted.`);
    });
  } catch (err) {
    emitError(opts, 'project_delete', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}


export async function mediaDeleteCommand(mediaId: string, opts: CommonOpts) {
  assertCleanIdentifier(mediaId, 'mediaId', opts);
  initSdk(opts.target);
  emitEvent(opts, 'media_delete_prepare', { mediaId });
  try {
    await mediaSdk.deleteMedia(mediaId);
    emitEvent(opts, 'media_delete_complete', { mediaId });
    emitResult(opts, { ok: true, mediaId }, () => {
      console.log(`Media ${mediaId} deleted.`);
    });
  } catch (err) {
    emitError(opts, 'media_delete', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}
