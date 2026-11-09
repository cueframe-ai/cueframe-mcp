// After a publish, every published `name@version` gets a git tag on the released commit, the same tag
// names `changeset publish` would create. The release gate reads them to find the previous release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagRelease } from './tag-release.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

function fakeGitHub(existing = {}) {
  const refs = { ...existing };
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push(`${init.method ?? 'GET'} ${u.pathname}`);
    assert.equal(u.origin, 'https://api.github.com');
    assert.equal(init.headers.authorization, 'Bearer app-token');
    const created = u.pathname === '/repos/cueframe-ai/cueframe-mcp/git/refs';
    if (init.method === 'POST' && created) {
      const body = JSON.parse(init.body);
      if (refs[body.ref]) return { ok: false, status: 422, json: async () => ({ message: 'Reference already exists' }) };
      refs[body.ref] = body.sha;
      return { ok: true, status: 201, json: async () => ({ ref: body.ref }) };
    }
    const read = u.pathname.match(/^\/repos\/cueframe-ai\/cueframe-mcp\/git\/ref\/(.+)$/);
    if (read) {
      const ref = `refs/${decodeURIComponent(read[1])}`;
      if (!refs[ref]) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ ref, object: { type: 'commit', sha: refs[ref] } }) };
    }
    return { ok: false, status: 500, json: async () => ({ message: `unexpected ${u.pathname}` }) };
  };
  return { fetch, refs, calls };
}

const base = { repository: 'cueframe-ai/cueframe-mcp', sha: SHA, token: 'app-token', logger: { log() {} } };

test('creates one tag per published package on the released commit', async () => {
  const gh = fakeGitHub();
  await tagRelease(['@cueframe/sdk@0.17.2', 'cueframe@0.12.1'], { ...base, fetch: gh.fetch });
  assert.deepEqual(gh.refs, { 'refs/tags/@cueframe/sdk@0.17.2': SHA, 'refs/tags/cueframe@0.12.1': SHA });
});

test('a tag that already points at the released commit is accepted, so a re-run is safe', async () => {
  const gh = fakeGitHub({ 'refs/tags/cueframe@0.12.1': SHA });
  await tagRelease(['cueframe@0.12.1'], { ...base, fetch: gh.fetch });
  assert.equal(gh.refs['refs/tags/cueframe@0.12.1'], SHA);
});

test('a tag that points at another commit fails and is not moved', async () => {
  const gh = fakeGitHub({ 'refs/tags/cueframe@0.12.1': OTHER });
  await assert.rejects(tagRelease(['cueframe@0.12.1'], { ...base, fetch: gh.fetch }), /cueframe@0\.12\.1 already points at b{40}/);
  assert.equal(gh.refs['refs/tags/cueframe@0.12.1'], OTHER);
});

test('any other API error fails, naming the tag', async () => {
  const fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'Resource not accessible by integration' }) });
  await assert.rejects(tagRelease(['cueframe@0.12.1'], { ...base, fetch }), /cueframe@0\.12\.1: HTTP 403 Resource not accessible by integration/);
});

test('refuses to run without a token, a commit or a well-formed name@version', async () => {
  const gh = fakeGitHub();
  await assert.rejects(tagRelease(['cueframe@0.12.1'], { ...base, token: '', fetch: gh.fetch }), /token/);
  await assert.rejects(tagRelease(['cueframe@0.12.1'], { ...base, sha: 'main', fetch: gh.fetch }), /commit/);
  await assert.rejects(tagRelease(['cueframe'], { ...base, fetch: gh.fetch }), /name@version/);
  assert.deepEqual(gh.calls, []);
});
