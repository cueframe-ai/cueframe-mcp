import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function checkReleaseHead({ sha, repository, lookup }) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) {
    throw new Error('Missing or invalid release SHA or repository');
  }
  const ref = JSON.parse(lookup(repository));
  if (ref.ref !== 'refs/heads/main' || ref.object?.type !== 'commit' || ref.object.sha !== sha) {
    throw new Error('Release SHA is not the current main head');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkReleaseHead({
      sha: process.env.RELEASE_SHA,
      repository: process.env.GITHUB_REPOSITORY,
      lookup: (repository) => execFileSync('gh', ['api', `repos/${repository}/git/ref/heads/main`], { encoding: 'utf8' }),
    });
  } catch (error) {
    console.error(`::error::Release head check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
