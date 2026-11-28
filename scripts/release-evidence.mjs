import { appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function evidence({ sha, ciRun, ciAttempt, run, attempt, jobs, plan, confirmed }) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || ![ciRun, ciAttempt, run, attempt].every(x => /^\d+$/.test(x || ''))) throw new Error('missing release or CI identity');
  for (const name of ['release-plan', 'publish', 'tag', 'registry']) {
    if (!['success', 'failure', 'cancelled', 'skipped'].includes(jobs[name]?.result)) throw new Error(`missing ${name} result`);
  }
  const planKnown = typeof plan === 'string';
  const planned = (planKnown ? plan : '').split(/\s+/).filter(Boolean);
  if (new Set(planned).size !== planned.length || planned.some(x => !/^(@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+$/.test(x))) throw new Error('invalid package plan');
  if (!Array.isArray(confirmed) || confirmed.some(x => !planned.includes(x)) || new Set(confirmed).size !== confirmed.length) throw new Error('invalid observed packages');
  const packages = planned.map(name => ({ name, publish: confirmed.includes(name) ? 'confirmed-by-changesets' : 'unknown' }));
  const noRelease = planKnown && jobs['release-plan'].result === 'success' && !planned.length && ['publish', 'tag', 'registry'].every(x => jobs[x].result === 'skipped');
  const complete = planned.length > 0 && ['release-plan', 'publish', 'tag', 'registry'].every(x => jobs[x].result === 'success') && packages.every(x => x.publish === 'confirmed-by-changesets');
  return { schema: 1, sha, ciRun, ciAttempt, run, attempt, planKnown, jobs: Object.fromEntries(Object.entries(jobs).map(([k, v]) => [k, v.result])), packages, outcome: noRelease ? 'no-publication-planned' : complete ? 'observed-complete' : 'investigate' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = JSON.parse(process.env.JOBS);
  const report = evidence({ sha: process.env.RELEASE_SHA, ciRun: process.env.CI_RUN, ciAttempt: process.env.CI_ATTEMPT, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, jobs, plan: jobs['release-plan'].outputs?.unpublished, confirmed: JSON.parse(jobs.publish.outputs?.confirmed || '[]') });
  writeFileSync(process.env.REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  appendFileSync(process.env.GITHUB_OUTPUT, `outcome=${report.outcome}\n`);
  console.log(JSON.stringify(report));
}
