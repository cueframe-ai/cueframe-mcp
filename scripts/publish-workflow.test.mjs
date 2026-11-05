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

// Board decisions, 2026-11-04 and 2026-11-05 (Paperclip CUE-49, CUE-51): Changesets; a release is the merge
// of the "Version packages" pull request, which Homer merges. No hand dispatch.
const versionPr = workflow.jobs['version-pr'];
const plan = workflow.jobs['release-plan'];
const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));

test('only a push to main runs the release workflow; there is no dispatch route to a publish', () => {
  assert.deepEqual(Object.keys(workflow.on), ['push']);
  assert.deepEqual(workflow.on.push, { branches: ['main'] });
  assert.match(workflow.jobs.validate.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow.jobs.validate.if, /github\.actor != 'github-actions\[bot\]'/);
});

test('publish runs only when main carries a version npm does not have, which only a merged Version packages PR creates', () => {
  assert.equal(publish.needs, 'release-plan');
  assert.equal(publish.if, "needs.release-plan.outputs.unpublished != ''");
  assert.equal(plan.needs, 'validate');
  assert.deepEqual(plan.permissions, { contents: 'read' });
  assert.match(plan.steps.map(runOf).join('\n'), /node scripts\/check-public-packages\.mjs --unpublished/);
  const checkout = steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.sha }}', 'publish ships the commit validate checked');
});

test('version-pr opens the Version packages PR with a pinned changesets/action and never publishes or pushes main', () => {
  assert.equal(versionPr.needs, 'validate');
  assert.deepEqual(versionPr.permissions, { contents: 'write', 'pull-requests': 'write', actions: 'write' });
  const action = versionPr.steps.find((s) => String(s.uses).startsWith('changesets/action@'));
  assert.match(action.uses, /^changesets\/action@[0-9a-f]{40}$/, 'pinned to a commit');
  assert.equal(action.with['publish-script'], undefined, 'no publish-script: the action only versions');
  assert.equal(action.with['version-script'], 'pnpm release:version');
  assert.equal(String(action.with['create-github-releases']), 'false');
  assert.equal(String(action.with['push-git-tags']), 'false');
  assert.doesNotMatch(versionPr.steps.map(runOf).join('\n'), /git push|changeset publish|npm publish/);
  assert.equal(versionPr.permissions['id-token'], undefined);
  const script = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts['release:version'];
  assert.equal(script, 'changeset version && node scripts/sync-contract-stamp.mjs && pnpm build:plugin');
});

test('no skip-ci marker can reach the Version packages commit, title or merge commit', () => {
  const action = versionPr.steps.find((s) => String(s.uses).startsWith('changesets/action@'));
  const marker = /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i;
  assert.doesNotMatch(action.with['commit-message'], marker);
  assert.doesNotMatch(action.with['pr-title'], marker);
  assert.doesNotMatch(text.replace(/^\s*#.*$/gm, ''), marker, 'no marker anywhere outside comments');
});

test('the Version packages PR gets CI: GITHUB_TOKEN starts no pull_request run, so CI is dispatched on its branch', () => {
  assert.ok('workflow_dispatch' in ci.on, 'ci.yml accepts workflow_dispatch');
  const step = versionPr.steps.find((s) => /gh workflow run ci\.yml/.test(runOf(s)));
  assert.ok(step, 'dispatch step');
  assert.match(runOf(step), /--ref changeset-release\/main/);
  assert.equal(step.env.GH_TOKEN, '${{ github.token }}');
});

test('write access and the OIDC token never share a job', () => {
  assert.deepEqual(publish.permissions, { contents: 'read', 'id-token': 'write' });
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (name === 'publish' || !job.permissions) continue;
    assert.equal(job.permissions['id-token'], undefined, `${name} cannot mint an OIDC token`);
  }
  assert.equal(publish.permissions.contents, 'read');
});

test('publish gates come before changeset publish, and the anonymous-access check waits for npm', () => {
  const index = (needle) => steps.findIndex((s) => runOf(s).includes(needle));
  assert.ok(index('pnpm build') < index('pnpm check:published-versions'));
  assert.ok(index('pnpm check:published-versions') < index('changeset publish'));
  assert.ok(index('changeset publish') < index('pnpm check:public-packages'));
  const verify = steps[index('pnpm check:public-packages')];
  assert.ok(verify['timeout-minutes'] > 10, 'the step outlives the 10-minute poll');
  assert.equal(verify.env?.PUBLIC_PACKAGES_TIMEOUT_SECONDS, undefined, 'the default 10-minute wait applies');
});
