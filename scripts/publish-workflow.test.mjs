// Static checks on .github/workflows/publish-npm.yml: npm trusted publishing (OIDC), no long-lived token.
// Requirements quoted from npm's "Trusted publishing for npm packages" page (docs.npmjs.com/trusted-publishers):
// npm CLI 11.5.1 or later, Node 22.14.0 or later, cloud-hosted runners only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const text = readFileSync(new URL('../.github/workflows/publish-npm.yml', import.meta.url), 'utf8');
const workflow = parse(text);
const publish = workflow.jobs.publish;
const steps = publish.steps;
const runOf = (step) => step.run ?? '';
const atLeast = (version, minimum) => {
  const a = version.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

test('no long-lived npm token is read anywhere in the workflow', () => {
  assert.doesNotMatch(text, /NPM_TOKEN|NODE_AUTH_TOKEN/);
});

test('the publish job can mint an OIDC token and stays on a GitHub-hosted runner', () => {
  assert.deepEqual(publish.permissions, { contents: 'read', 'id-token': 'write' });
  assert.equal(publish['runs-on'], 'ubuntu-latest');
});

test('setup-node writes no registry auth line, so a failed OIDC exchange cannot fall back to a placeholder token', () => {
  const setupNode = steps.find((step) => String(step.uses).startsWith('actions/setup-node@'));
  assert.ok(setupNode, 'setup-node step');
  assert.ok(Number(setupNode.with['node-version']) >= 24, 'Node 24 or later (trusted publishing needs >= 22.14.0)');
  assert.equal(setupNode.with['registry-url'], undefined);
});

test('a pinned npm >= 11.5.1 is installed and asserted before anything is published', () => {
  const publishIndex = steps.findIndex((step) => /pnpm publish/.test(runOf(step)));
  const npmIndex = steps.findIndex((step) => /npm install --global npm@/.test(runOf(step)));
  assert.ok(npmIndex >= 0, 'npm upgrade step');
  assert.ok(npmIndex < publishIndex, 'npm is upgraded before the publish step');
  const pinned = runOf(steps[npmIndex]).match(/npm install --global npm@(\d+\.\d+\.\d+)\b/);
  assert.ok(pinned, 'npm is pinned to an exact version');
  assert.ok(atLeast(pinned[1], '11.5.1'), `npm ${pinned[1]} is older than 11.5.1`);
  assert.match(runOf(steps[npmIndex]), /npm --version/);
});

test('packages are packed by pnpm (workspace: ranges and publishConfig overrides rewritten), in dependency order', () => {
  const step = steps.find((s) => /pnpm publish/.test(runOf(s)));
  assert.doesNotMatch(runOf(step), /(^|[^p])npm publish/, 'publishing a package directory with npm ships the raw manifest');
  assert.match(runOf(step), /for package_dir in packages\/api-contract packages\/sdk packages\/skills packages\/cli;/);
  assert.match(runOf(step), /already published; skipping/);
  assert.match(runOf(step), /--provenance/);
});

test('the published-versions and anonymous-access gates still run', () => {
  const runs = steps.map(runOf).join('\n');
  assert.match(runs, /pnpm check:published-versions/);
  assert.match(runs, /pnpm check:public-packages/);
});
