// The versions the pending changesets (`.changeset/*.md`) will give each package when the merge to main
// runs `changeset version`. Checks that tie a derived value to a package version (the contract manifest's
// contractVersion, the skills' `cueframe@<major.minor>` pin, "is this content already published?") compare
// against the planned version, because with Changesets a pull request never edits `version` itself.
import getReleasePlanModule from '@changesets/get-release-plan';

const getReleasePlan = getReleasePlanModule.default ?? getReleasePlanModule;

/** Map of package name → planned new version, for every package a pending changeset releases. */
export async function plannedVersions(root) {
  const plan = await getReleasePlan(root);
  return new Map(plan.releases.filter((r) => r.type !== 'none').map((r) => [r.name, r.newVersion]));
}
