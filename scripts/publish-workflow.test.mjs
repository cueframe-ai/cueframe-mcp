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
const version = workflow.jobs.version;
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
  const publishIndex = steps.findIndex((step) => /changeset publish/.test(runOf(step)));
  const npmIndex = steps.findIndex((step) => /npm install --global npm@/.test(runOf(step)));
  assert.ok(npmIndex >= 0, 'npm upgrade step');
  assert.ok(npmIndex < publishIndex, 'npm is upgraded before the publish step');
  const pinned = runOf(steps[npmIndex]).match(/npm install --global npm@(\d+\.\d+\.\d+)\b/);
  assert.ok(pinned, 'npm is pinned to an exact version');
  assert.ok(atLeast(pinned[1], '11.5.1'), `npm ${pinned[1]} is older than 11.5.1`);
  assert.match(runOf(steps[npmIndex]), /npm --version/);
});

test('changeset publish packs through pnpm (workspace: ranges and publishConfig rewritten) and skips published versions', () => {
  const step = steps.find((s) => /changeset publish/.test(runOf(s)));
  assert.ok(step, 'changeset publish step');
  assert.doesNotMatch(runOf(step), /(^|[^p])npm publish/, 'publishing a package directory with npm ships the raw manifest');
  // pnpm is the workspace's packageManager, so @changesets/cli publishes each package with `pnpm publish`.
  assert.match(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).packageManager, /^pnpm@/);
  assert.equal(step.env.NPM_CONFIG_PROVENANCE, '${{ github.event.repository.private == false }}');
});

test('the published-versions and anonymous-access gates still run', () => {
  const runs = steps.map(runOf).join('\n');
  assert.match(runs, /pnpm check:published-versions/);
  assert.match(runs, /pnpm check:public-packages/);
});

// Board decision, 2026-11-04 (Paperclip CUE-49): Changesets, publish on merge, no release pull request.
test('a push to main (or a dispatch on main) releases; nothing else does', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['push', 'workflow_dispatch']);
  assert.deepEqual(workflow.on.push, { branches: ['main'] });
  assert.match(workflow.jobs.validate.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(version.if, /github\.ref == 'refs\/heads\/main'/);
  assert.deepEqual(publish.needs, 'version');
  assert.equal(publish.if, "needs.version.outputs.release_sha != ''");
});

test('the version commit cannot start another release: GITHUB_TOKEN push, [skip ci], and an actor guard', () => {
  const run = version.steps.map(runOf).join('\n');
  assert.match(run, /echo 'chore\(release\): version packages \[skip ci\]'/);
  assert.match(run, /git push "https:\/\/x-access-token:\$\{GITHUB_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" HEAD:refs\/heads\/main/);
  const step = version.steps.find((s) => /git push/.test(runOf(s)));
  assert.equal(step.env.GITHUB_TOKEN, '${{ github.token }}', 'a push made with GITHUB_TOKEN starts no workflow run');
  assert.doesNotMatch(run, /--force|-f /, 'the version commit is a fast-forward or nothing');
  assert.match(workflow.jobs.validate.if, /github\.actor != 'github-actions\[bot\]'/);
});

test('write access and the OIDC token never share a job', () => {
  assert.deepEqual(version.permissions, { contents: 'write' });
  assert.deepEqual(publish.permissions, { contents: 'read', 'id-token': 'write' });
  const checkout = version.steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.equal(checkout.with['persist-credentials'], false, 'only the push step sees the token');
  assert.equal(checkout.with.ref, '${{ github.sha }}', 'the commit CI validated is the one versioned');
  const publishCheckout = steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.equal(publishCheckout.with.ref, '${{ needs.version.outputs.release_sha }}');
});

test('version runs changeset version, restamps the plugin manifests, then commits; publish gates come before changeset publish', () => {
  const run = runOf(version.steps.find((s) => /changeset version/.test(runOf(s))));
  const order = ['pnpm changeset version', 'pnpm build:plugin', 'git commit', 'git push'].map((needle) => run.indexOf(needle));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), `order ${order}`);
  const index = (needle) => steps.findIndex((s) => runOf(s).includes(needle));
  assert.ok(index('pnpm build') < index('pnpm check:published-versions'));
  assert.ok(index('pnpm check:published-versions') < index('changeset publish'));
  assert.ok(index('changeset publish') < index('pnpm check:public-packages'));
});
