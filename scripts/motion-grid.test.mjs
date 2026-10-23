import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../skills/cueframe-reference-video/scripts/motion-grid.sh', import.meta.url));
const available = ['ffmpeg', 'ffprobe'].every((tool) => spawnSync(tool, ['-version']).status === 0);
const run = (command, args) => {
  const result = spawnSync(command, args, { maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
};
const color = (n) => [20 + 30 * n, 40, 180 - 15 * n];

test('motion grids select exact source frames and report actual rational-rate timestamps', { skip: !available }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cueframe-grid-test-'));
  try {
    for (let n = 0; n < 7; n++) {
      const pixels = Buffer.alloc(32 * 24 * 3);
      for (let i = 0; i < pixels.length; i += 3) pixels.set(color(n), i);
      writeFileSync(join(dir, `frame-${String(n).padStart(2, '0')}.ppm`), Buffer.concat([Buffer.from('P6\n32 24\n255\n'), pixels]));
    }
    const input = join(dir, 'source.nut');
    run('ffmpeg', ['-v', 'error', '-framerate', '30000/1001', '-i', join(dir, 'frame-%02d.ppm'), '-c:v', 'ffv1', '-pix_fmt', 'bgr0', input]);
    const sample = (name, args) => {
      const output = join(dir, name);
      run('bash', [script, input, output, '--overview-fps', '15', '--dense-fps', '15', ...args]);
      const [header, ...rows] = readFileSync(join(output, 'overview-index.tsv'), 'utf8').trim().split('\n').map((line) => line.split('\t'));
      assert.deepEqual(header, ['page', 'cell', 'time_sec', 'source_frame', 'source_pts', 'source_pts_time_sec', 'target_time_sec']);
      const image = run('ffmpeg', ['-v', 'error', '-i', join(output, 'overview-001.jpg'), '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
      const width = 4 * 384 + 5 * 8;
      for (const row of rows) {
        const cell = Number(row[1]) - 1;
        const x = 8 + (cell % 4) * (384 + 8) + 20;
        const y = 8 + Math.floor(cell / 4) * (288 + 8) + 20;
        const offset = (y * width + x) * 3;
        const expected = color(Number(row[3]));
        for (let channel = 0; channel < 3; channel++) {
          assert.ok(Math.abs(image[offset + channel] - expected[channel]) <= 8, `cell ${cell} pixels must match source frame ${row[3]}`);
        }
        assert.ok(Math.abs(Number(row[2]) - Number(row[3]) * 1001 / 30000) < 0.000002);
        assert.ok(Number(row[2]) + 0.000001 >= Number(row[6]));
      }
      return rows;
    };
    assert.deepEqual(sample('whole', []).map((row) => Number(row[3])), [0, 2, 4, 6]);
    const offset = sample('offset', ['--start', '0.035', '--duration', '0.17']);
    assert.deepEqual(offset.map((row) => Number(row[3])), [2, 4, 6]);
    assert.equal(offset[0][6], '0.035000');
    assert.equal(offset[0][2], '0.066733');
    assert.deepEqual(sample('last', ['--start', '0.2', '--duration', '0.02']).map((row) => Number(row[3])), [6]);
    const empty = spawnSync('bash', [script, input, join(dir, 'empty'), '--start', '0.3'], { encoding: 'utf8' });
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /no source frames/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
