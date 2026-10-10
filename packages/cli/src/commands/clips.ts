import { clips, media } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

interface ClipsOptions {
  target: 'local' | 'prod';
  json?: boolean;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function clipsCommand(mediaItemId: string | undefined, options: ClipsOptions) {
  if (mediaItemId !== undefined) {
    assertCleanIdentifier(mediaItemId, 'mediaItemId', options);
  }
  initSdk(options.target);
  emitEvent(options, 'clips_prepare', {
    target: options.target,
    mode: mediaItemId ? 'suggestions' : 'media-list',
    ...(mediaItemId ? { mediaItemId } : {}),
  });

  try {
    if (!mediaItemId) {
      const out = await media.listMedia();
      emitEvent(options, 'clips_complete', {
        mode: 'media-list',
        count: out.data.length,
        media: out.data,
      });
      if (!options.json) {
        if (out.data.length === 0) {
          console.log('No media items found. Import a video first.');
          return;
        }
        console.log('Media items (pass the ID to `cueframe clips <id>`):');
        console.log('');
        for (const m of out.data) {
          const dur = m.duration ? `${formatTime(m.duration)} ` : '';
          const phase = m.processingStatus?.phase ?? 'unknown';
          const status = phase === 'complete' ? '' : ` [${phase}]`;
          console.log(`  ${m.id}  ${m.name}  ${dur}${status}`);
        }
      }
      return;
    }

    const result = await clips.listMediaSuggestions(mediaItemId);
    emitEvent(options, 'clips_complete', {
      mode: 'suggestions',
      mediaItemId,
      count: result.suggestions.length,
      suggestions: result.suggestions,
    });
    if (!options.json) {
      if (result.suggestions.length === 0) {
        console.log('No clip suggestions found for this media item.');
        console.log('If analysis is still running, try again shortly. Otherwise the video may not have suitable clips.');
        return;
      }

      console.log(`${result.suggestions.length} clip suggestion${result.suggestions.length !== 1 ? 's' : ''}:`);
      console.log('');

      for (const clip of result.suggestions) {
        const range = `${formatTime(clip.trim.start)} → ${formatTime(clip.trim.end)}`;
        const dur = (clip.trim.end - clip.trim.start).toFixed(1);
        console.log(`  ${clip.id}`);
        console.log(`    ${clip.title}`);
        console.log(`    ${range}  (${dur}s)  ${clip.format}  score: ${clip.score}`);
        if (clip.reason) {
          console.log(`    ${clip.reason}`);
        }
        console.log('');
      }
    }
  } catch (err) {
    emitError(options, 'clips', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}
