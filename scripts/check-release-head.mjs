export async function checkReleaseHead({ sha, repository, token, fetch = globalThis.fetch }) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !token) {
    throw new Error('Missing or invalid release SHA, repository or token');
  }
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`Main ref lookup failed: HTTP ${response.status}`);
  const ref = await response.json();
  if (ref.ref !== 'refs/heads/main' || ref.object?.type !== 'commit' || ref.object.sha !== sha) {
    throw new Error('Release SHA is not the current main head');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    await checkReleaseHead({ sha: process.env.RELEASE_SHA, repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN });
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
