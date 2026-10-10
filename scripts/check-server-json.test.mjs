import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { checkServerJson, REMOTE_URL, VENDORED_SCHEMA } from './check-server-json.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const server = read('server.json');
const schema = read(VENDORED_SCHEMA);

test('the committed server.json passes', () => {
  assert.deepEqual(checkServerJson(server, schema), []);
});

test('an npm package entry is refused', () => {
  const problems = checkServerJson({ ...server, packages: [{ registryType: 'npm', identifier: 'x', version: '1', transport: { type: 'stdio' } }] }, schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /must not list npm packages/);
});

test('a remote other than the hosted server is refused', () => {
  const problems = checkServerJson({ ...server, remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }] }, schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(REMOTE_URL.replace(/[./]/g, '\\$&')));
});

test('the registry schema is enforced: a missing version fails', () => {
  const { version, ...withoutVersion } = server;
  const problems = checkServerJson(withoutVersion, schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /required property 'version'/);
});

test('formats are validated: a websiteUrl that is not a URI fails', () => {
  const problems = checkServerJson({ ...server, websiteUrl: 'not a url' }, schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /websiteUrl.*format "uri"/);
});
