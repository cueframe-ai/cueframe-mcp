// Checks on install-only registry authentication and token-free npm trusted publishing (OIDC).
// Requirements quoted from npm's "Trusted publishing for npm packages" page (docs.npmjs.com/trusted-publishers):
// npm CLI 11.5.1 or later, Node 22.14.0 or later, cloud-hosted runners only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('the read token is confined to exactly three frozen-install steps', () => {
  const allowed = new Map([[ci.jobs.node, 1], [versionPr, 1], [publish, 1]]);
  assert.deepEqual(ci.on.workflow_call.secrets, { NPM_TOKEN: { required: true } });
  for (const document of [workflow, ci]) {
    assert.doesNotMatch(JSON.stringify(document.env ?? {}), /NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_USERCONFIG/);
    for (const job of Object.values(document.jobs)) {
      assert.doesNotMatch(JSON.stringify(job.env ?? {}), /NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_USERCONFIG/);
      if (job === workflow.jobs.validate) assert.deepEqual(job.secrets, { NPM_TOKEN: '${{ secrets.NPM_TOKEN }}' });
      else assert.doesNotMatch(JSON.stringify(job.secrets ?? {}), /NPM_TOKEN|NODE_AUTH_TOKEN/);
      let count = 0;
      for (const step of job.steps ?? []) {
        if (String(step.uses).startsWith('actions/setup-node@')) assert.equal(step.with?.['registry-url'], undefined);
        if (allowed.has(job) && step.name === 'pnpm install') {
          count++;
          assert.deepEqual(step.env, { NPM_TOKEN: '${{ secrets.NPM_TOKEN }}' });
          assert.match(step.run, /umask 077/);
          assert.match(step.run, /mktemp "\$RUNNER_TEMP\/cueframe-npmrc\.XXXXXX"/);
          assert.match(step.run, /trap 'rm -f "\$install_npmrc"' EXIT/);
          assert.ok(step.run.includes("'//registry.npmjs.org/:_authToken=${NPM_TOKEN}'"));
          assert.match(step.run, /NPM_CONFIG_USERCONFIG="\$install_npmrc" pnpm install --frozen-lockfile/);
          assert.doesNotMatch(step.run, /NODE_AUTH_TOKEN|GITHUB_ENV|npm config set|export NPM_CONFIG_USERCONFIG/);
        } else assert.doesNotMatch(JSON.stringify(step), /NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_USERCONFIG|_authToken/);
      }
      assert.equal(count, allowed.get(job) ?? 0);
    }
  }
});

test('temporary install authentication is removed after a successful or failed child', () => {
  const scripts = [ci.jobs.node, versionPr, publish].map(job => job.steps.find(step => step.name === 'pnpm install').run);
  assert.ok(scripts.every(script => script === scripts[0]));
  for (const exitCode of [0, 17]) {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-install-auth-'));
    try {
      const bin = join(dir, 'bin');
      mkdirSync(bin);
      writeFileSync(join(bin, 'pnpm'), `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const config = process.env.NPM_CONFIG_USERCONFIG;
if (!config || fs.statSync(config).mode % 512 !== 384) process.exit(21);
if (fs.readFileSync(config, 'utf8') !== '//registry.npmjs.org/:_authToken=\${NPM_TOKEN}\\n') process.exit(22);
if (JSON.stringify(process.argv.slice(2)) !== '["install","--frozen-lockfile"]') process.exit(23);
fs.writeFileSync(path.join(process.env.RUNNER_TEMP, 'used-config-path'), config);
process.exit(Number(process.env.FAKE_INSTALL_EXIT));
`, { mode: 0o755 });
      let status = 0;
      try {
        execFileSync('bash', ['-c', scripts[0]], { env: { PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: dir,
          NPM_TOKEN: 'synthetic-read-token', FAKE_INSTALL_EXIT: String(exitCode) }, stdio: 'pipe' });
      } catch (error) { status = error.status; }
      assert.equal(status, exitCode);
      const used = readFileSync(join(dir, 'used-config-path'), 'utf8');
      assert.equal(existsSync(used), false, 'the auth config must not reach a later publish step');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
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

test('the published-versions gate runs; the anonymous-access check is not part of the publish job', () => {
  const runs = steps.map(runOf).join('\n');
  assert.match(runs, /pnpm check:published-versions/);
  // `npm publish` exiting 0 is the success signal; npm may take minutes to serve a new version, so an
  // anonymous check right after a publish races npm. It runs later, outside this workflow.
  assert.doesNotMatch(runs, /check:public-packages|check-public-packages\.mjs(?! --unpublished)/);
});

// A release is the merge of the Changesets "Version packages" pull request. No hand dispatch.
const versionPr = workflow.jobs['version-pr'];
const plan = workflow.jobs['release-plan'];
const tag = workflow.jobs.tag;
const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const appToken = (job) => job.steps.find((s) => String(s.uses).startsWith('actions/create-github-app-token@'));

test('only a push to main runs the release workflow; there is no dispatch route to a publish', () => {
  assert.deepEqual(Object.keys(workflow.on), ['push']);
  assert.deepEqual(workflow.on.push, { branches: ['main'] });
  assert.match(workflow.jobs.validate.if, /github\.ref == 'refs\/heads\/main'/);
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

test('version-pr opens the Version packages PR with pinned changesets/action v1 and an App token, and never publishes', () => {
  assert.equal(versionPr.needs, 'validate');
  assert.deepEqual(versionPr.permissions, { contents: 'read' }, 'the write access is the App token, not GITHUB_TOKEN');
  const action = versionPr.steps.find((s) => String(s.uses).startsWith('changesets/action@'));
  // v2 of the action refuses @changesets/cli 2.x; v1.9.0 is the line that supports it.
  assert.equal(action.uses, 'changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d');
  assert.match(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).devDependencies['@changesets/cli'], /^\^2\./);
  assert.equal(action.with.publish, undefined, 'no publish input: the action only versions');
  assert.equal(action.with.version, 'pnpm release:version');
  assert.equal(action.with.commitMode, 'github-api');
  assert.equal(String(action.with.createGithubReleases), 'false');
  assert.equal(action.with['github-token'], '${{ steps.app-token.outputs.token }}');
  assert.doesNotMatch(versionPr.steps.map(runOf).join('\n'), /git push|changeset publish|npm publish|gh workflow run/);
  const script = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts['release:version'];
  assert.equal(script, 'changeset version && node scripts/sync-contract-stamp.mjs && pnpm build:plugin');
});

test('the App token is minted from repository secrets, narrowed, and the job fails closed without them', () => {
  for (const [name, job, permissions] of [
    ['version-pr', versionPr, { 'permission-contents': 'write', 'permission-pull-requests': 'write' }],
    ['tag', tag, { 'permission-contents': 'write' }],
  ]) {
    const step = appToken(job);
    assert.ok(step, `${name} mints an App token`);
    assert.equal(step.id, 'app-token');
    assert.match(step.uses, /^actions\/create-github-app-token@[0-9a-f]{40}$/, 'pinned to a commit');
    assert.equal(step.with['app-id'], '${{ secrets.RELEASE_APP_ID }}');
    assert.equal(step.with['private-key'], '${{ secrets.RELEASE_APP_PRIVATE_KEY }}');
    for (const [key, value] of Object.entries(permissions)) assert.equal(step.with[key], value, `${name} ${key}`);
    const extra = Object.keys(step.with).filter((k) => k.startsWith('permission-') && !(k in permissions));
    assert.deepEqual(extra, [], `${name} asks for no other permission`);
    const guard = job.steps.findIndex((s) => /RELEASE_APP_ID/.test(runOf(s)) && /exit 1/.test(runOf(s)));
    assert.ok(guard >= 0 && guard < job.steps.indexOf(step), `${name} fails before minting when a secret is missing`);
  }
  assert.doesNotMatch(text, /github\.token|secrets\.GITHUB_TOKEN/, 'nothing falls back to GITHUB_TOKEN');
});

test('the Version packages PR gets ordinary pull_request CI, because an App token opened it', () => {
  assert.ok('pull_request' in ci.on);
  assert.equal('workflow_dispatch' in ci.on, false, 'no dispatch route is needed');
});

test('tag marks each published package on the released commit with the App token', () => {
  assert.deepEqual(tag.needs, ['release-plan', 'publish'], 'skipped with publish; reads the release plan');
  assert.deepEqual(tag.permissions, { contents: 'read' });
  const step = tag.steps.find((s) => /node scripts\/tag-release\.mjs/.test(runOf(s)));
  assert.ok(step, 'tag step');
  assert.match(runOf(step), /needs\.release-plan\.outputs\.unpublished|UNPUBLISHED/);
  assert.equal(step.env.GH_TOKEN, '${{ steps.app-token.outputs.token }}');
  const checkout = tag.steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.match(runOf(steps.find((s) => /changeset publish/.test(runOf(s)))), /--no-git-tag/);
});

test('no skip-ci marker can reach the Version packages commit, title or merge commit', () => {
  const action = versionPr.steps.find((s) => String(s.uses).startsWith('changesets/action@'));
  const marker = /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i;
  assert.doesNotMatch(action.with.commit, marker);
  assert.doesNotMatch(action.with.title, marker);
  assert.doesNotMatch(text.replace(/^\s*#.*$/gm, ''), marker, 'no marker anywhere outside comments');
});

test('write access and the OIDC token never share a job', () => {
  assert.deepEqual(publish.permissions, { contents: 'read', 'id-token': 'write' });
  assert.equal(appToken(publish), undefined, 'publish mints no App token');
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (name === 'publish' || !job.permissions) continue;
    assert.equal(job.permissions['id-token'], undefined, `${name} cannot mint an OIDC token`);
  }
});

test('publish gates come before changeset publish', () => {
  const index = (needle) => steps.findIndex((s) => runOf(s).includes(needle));
  assert.ok(index('pnpm build') < index('pnpm check:published-versions'));
  assert.ok(index('pnpm check:published-versions') < index('changeset publish'));
  assert.equal(steps.at(-1), steps[index('changeset publish')], 'nothing polls npm after the publish');
});
