// The post-publish gate waits for npm: a version npm has just accepted "may take a few minutes" to be
// served (docs.npmjs.com), and the 2026-11-04 trusted-publishing run 41939613726 failed this gate 0.03 s
// after its last publish although all four versions were live minutes later. The clock and fetch are
// injected, so these cases do not sleep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForPackages } from './check-public-packages.mjs';

const REGISTRY = 'https://registry.npmjs.org';
const pkgs = [
  { name: '@cueframe/sdk', version: '0.17.2' },
  { name: 'cueframe', version: '0.12.1' },
];

// A fake registry. `availableAt` maps "name@version" to the fake time (ms) from which npm serves it;
// `tarballAt` does the same for tarballs (default: with the metadata). Returns fetch, sleep and the request log.
function fakeNpm({ availableAt, tarballAt = availableAt }) {
  let now = 0;
  const requests = [];
  const sleeps = [];
  const json = (status, body) => ({ ok: status === 200, status, json: async () => body });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    requests.push(`${init.method ?? 'GET'} ${u.pathname} @${now}`);
    assert.equal(u.origin, REGISTRY);
    const tarball = u.pathname.match(/^\/(.+)\/-\/[^/]+-(\d+\.\d+\.\d+)\.tgz$/);
    if (tarball) {
      const at = tarballAt[`${tarball[1]}@${tarball[2]}`];
      return json(at !== undefined && now >= at ? 200 : 404, null);
    }
    const meta = u.pathname.match(/^\/(.+)\/(\d+\.\d+\.\d+)$/);
    const name = decodeURIComponent(meta[1]);
    const at = availableAt[`${name}@${meta[2]}`];
    if (at === undefined || now < at) return json(404, { error: 'Not found' });
    const base = name.split('/').pop();
    return json(200, { name, version: meta[2], dist: { tarball: `${REGISTRY}/${name}/-/${base}-${meta[2]}.tgz` } });
  };
  const sleep = async (ms) => {
    sleeps.push(ms);
    now += ms;
  };
  return { fetch, sleep, clock: () => now, requests, sleeps };
}

const quiet = { log() {}, error() {} };

test('versions npm already serves pass at once, with no wait', async () => {
  const npm = fakeNpm({ availableAt: { '@cueframe/sdk@0.17.2': 0, 'cueframe@0.12.1': 0 } });
  const result = await waitForPackages(pkgs, { ...npm, now: npm.clock, logger: quiet });
  assert.deepEqual(result.missing, []);
  assert.deepEqual(npm.sleeps, []);
  assert.equal(npm.requests.length, 4, 'one metadata GET and one tarball HEAD per package');
});

test('a version that 404s for a while passes once npm serves it, polling every 15 s', async () => {
  // sdk metadata appears at 40 s and its tarball 20 s later; cueframe is live from the start.
  const npm = fakeNpm({
    availableAt: { '@cueframe/sdk@0.17.2': 40_000, 'cueframe@0.12.1': 0 },
    tarballAt: { '@cueframe/sdk@0.17.2': 60_000, 'cueframe@0.12.1': 0 },
  });
  const result = await waitForPackages(pkgs, { ...npm, now: npm.clock, logger: quiet });
  assert.deepEqual(result.missing, []);
  assert.ok(npm.sleeps.every((ms) => ms === 15_000), `slept ${npm.sleeps}`);
  assert.equal(npm.clock(), 60_000, 'passes on the first poll after both metadata and tarball are served');
  assert.deepEqual(npm.requests.filter((r) => r.startsWith('GET /cueframe/')), ['GET /cueframe/0.12.1 @0'], 'a passing package is not re-polled');
});

test('a version still missing at the 10-minute timeout fails, naming the package, version and URL', async () => {
  const npm = fakeNpm({ availableAt: { 'cueframe@0.12.1': 0 } });
  const errors = [];
  const result = await waitForPackages(pkgs, { ...npm, now: npm.clock, logger: { log() {}, error: (m) => errors.push(m) } });
  assert.equal(result.missing.length, 1);
  const [miss] = result.missing;
  assert.equal(miss.name, '@cueframe/sdk');
  assert.equal(miss.version, '0.17.2');
  assert.equal(miss.url, `${REGISTRY}/%40cueframe%2Fsdk/0.17.2`);
  assert.match(miss.reason, /HTTP 404/);
  assert.ok(npm.clock() >= 600_000 && npm.clock() < 600_000 + 15_000, `gave up at ${npm.clock()} ms`);
  assert.ok(errors.some((m) => m.includes('@cueframe/sdk@0.17.2') && m.includes(miss.url)), errors.join('\n'));
});

test('a tarball that never appears fails with the tarball URL', async () => {
  const npm = fakeNpm({ availableAt: { '@cueframe/sdk@0.17.2': 0 }, tarballAt: {} });
  const result = await waitForPackages([pkgs[0]], { ...npm, now: npm.clock, logger: quiet });
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].url, `${REGISTRY}/@cueframe/sdk/-/sdk-0.17.2.tgz`);
  assert.match(result.missing[0].reason, /tarball HTTP 404/);
});

test('wrong metadata identity or a foreign tarball origin is a failure, not something to wait out', async () => {
  const fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ name: 'cueframe', version: '0.12.1', dist: { tarball: 'https://evil.example/cueframe-0.12.1.tgz' } }),
  });
  let slept = 0;
  const result = await waitForPackages([pkgs[1]], {
    fetch,
    sleep: async (ms) => {
      slept += ms;
    },
    now: () => slept,
    logger: quiet,
  });
  assert.equal(result.missing.length, 1);
  assert.match(result.missing[0].reason, /unexpected tarball origin/);
  assert.equal(slept, 0, 'no polling for a permanent failure');
});

// The publish job runs only when main carries a version npm does not have: after a Version packages merge.
test('the release plan lists only versions npm answers 404 for, and fails on any other registry error', async () => {
  const { unpublishedPackages } = await import('./check-public-packages.mjs');
  const status = { '/cueframe/0.12.1': 404, '/%40cueframe%2Fsdk/0.17.2': 200 };
  const fetch = async (url) => ({ ok: status[new URL(url).pathname] === 200, status: status[new URL(url).pathname] });
  assert.deepEqual(await unpublishedPackages(pkgs, { fetch }), [{ name: 'cueframe', version: '0.12.1' }]);
  status['/cueframe/0.12.1'] = 503;
  await assert.rejects(unpublishedPackages(pkgs, { fetch }), /cueframe@0\.12\.1: registry HTTP 503/);
});
