// check:public-packages checks anonymous metadata and tarball access once, with no waiting; it is not part
// of the publish job. The release plan (`--unpublished`) lists what the next publish ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackages, unpublishedPackages } from './check-public-packages.mjs';

const REGISTRY = 'https://registry.npmjs.org';
const pkgs = [
  { name: '@cueframe/sdk', version: '0.17.2' },
  { name: 'cueframe', version: '0.12.1' },
];

// A fake registry serving the "name@version" keys in `metadata` and `tarballs`.
function fakeNpm({ metadata, tarballs = metadata }) {
  const requests = [];
  const json = (status, body) => ({ ok: status === 200, status, json: async () => body });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    requests.push(`${init.method ?? 'GET'} ${u.pathname}`);
    assert.equal(u.origin, REGISTRY);
    const tarball = u.pathname.match(/^\/(.+)\/-\/[^/]+-(\d+\.\d+\.\d+)\.tgz$/);
    if (tarball) return json(tarballs.includes(`${tarball[1]}@${tarball[2]}`) ? 200 : 404, null);
    const meta = u.pathname.match(/^\/(.+)\/(\d+\.\d+\.\d+)$/);
    const name = decodeURIComponent(meta[1]);
    if (!metadata.includes(`${name}@${meta[2]}`)) return json(404, { error: 'Not found' });
    const base = name.split('/').pop();
    return json(200, { name, version: meta[2], dist: { tarball: `${REGISTRY}/${name}/-/${base}-${meta[2]}.tgz` } });
  };
  return { fetch, requests };
}

const quiet = { log() {}, error() {} };

test('served versions pass with one metadata GET and one tarball HEAD each', async () => {
  const npm = fakeNpm({ metadata: ['@cueframe/sdk@0.17.2', 'cueframe@0.12.1'] });
  const result = await checkPackages(pkgs, { fetch: npm.fetch, logger: quiet });
  assert.deepEqual(result.missing, []);
  assert.equal(npm.requests.length, 4);
});

test('a missing version fails at once, naming the package, version and URL', async () => {
  const npm = fakeNpm({ metadata: ['cueframe@0.12.1'] });
  const errors = [];
  const result = await checkPackages(pkgs, { fetch: npm.fetch, logger: { log() {}, error: (m) => errors.push(m) } });
  assert.equal(result.missing.length, 1);
  const [miss] = result.missing;
  assert.equal(miss.name, '@cueframe/sdk');
  assert.equal(miss.url, `${REGISTRY}/%40cueframe%2Fsdk/0.17.2`);
  assert.match(miss.reason, /HTTP 404/);
  assert.equal(npm.requests.filter((r) => r.includes('sdk')).length, 1, 'no retry');
  assert.ok(errors.some((m) => m.includes('@cueframe/sdk@0.17.2') && m.includes(miss.url)), errors.join('\n'));
});

test('a missing tarball fails with the tarball URL', async () => {
  const npm = fakeNpm({ metadata: ['@cueframe/sdk@0.17.2'], tarballs: [] });
  const result = await checkPackages([pkgs[0]], { fetch: npm.fetch, logger: quiet });
  assert.equal(result.missing[0].url, `${REGISTRY}/@cueframe/sdk/-/sdk-0.17.2.tgz`);
  assert.match(result.missing[0].reason, /tarball HTTP 404/);
});

test('a foreign tarball origin fails', async () => {
  const fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ name: 'cueframe', version: '0.12.1', dist: { tarball: 'https://evil.example/cueframe-0.12.1.tgz' } }),
  });
  const result = await checkPackages([pkgs[1]], { fetch, logger: quiet });
  assert.match(result.missing[0].reason, /unexpected tarball origin/);
});

// The publish job runs only when main carries a version npm does not have: after a Version packages merge.
test('the release plan lists only versions npm answers 404 for, and fails on any other registry error', async () => {
  const status = { '/cueframe/0.12.1': 404, '/%40cueframe%2Fsdk/0.17.2': 200 };
  const fetch = async (url) => ({ ok: status[new URL(url).pathname] === 200, status: status[new URL(url).pathname] });
  assert.deepEqual(await unpublishedPackages(pkgs, { fetch }), [{ name: 'cueframe', version: '0.12.1' }]);
  status['/cueframe/0.12.1'] = 503;
  await assert.rejects(unpublishedPackages(pkgs, { fetch }), /cueframe@0\.12\.1: registry HTTP 503/);
});
