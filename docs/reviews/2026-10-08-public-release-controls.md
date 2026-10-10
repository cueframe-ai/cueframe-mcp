# Public release controls and package availability

Reviewed against main `f682b0cd` on October 8, 2026. This records readiness work,
not a completed publication. The repository remains private.

## Verified repository settings

- Default Actions token is read-only; workflows cannot approve pull requests.
- Actions SHA pinning is now required at repository level (API readback verified).
- Dependency vulnerability alerts are now enabled (API returned 204 on readback).
- Every third-party action in the three workflows is pinned to a full SHA.
- CI runs on `pull_request`, never `pull_request_target`, and receives no release secrets.
- Checkout credentials are not persisted. Release secrets are limited to the
  manual main-branch publisher, after the reusable CI workflow succeeds.
- `SECURITY.md` provides a private reporting address. GitHub private vulnerability
  reporting returned 404; it was not verified enabled.
- Branch protection and ruleset APIs return 403: unavailable under the current
  private-repository plan. These controls are **not enabled** by the JSON file below.
- Latest main CI run 37795243934 failed with zero steps in both jobs; this is not
  passing release evidence. Resolve the Actions execution block before release.

## Apply at the authorized visibility switch

Do not change visibility until the separate content/history clearance is recorded.
Once public (or after a plan upgrade), apply the prepared main-branch policy:

```sh
gh api --method PUT repos/cueframe-ai/cueframe-mcp/branches/main/protection \
  --input .github/release-main-protection.json
gh api --method PUT repos/cueframe-ai/cueframe-mcp/private-vulnerability-reporting
gh api --method PATCH repos/cueframe-ai/cueframe-mcp \
  --input .github/release-secret-protection.json
```

The branch policy requires a PR, passing `node` and `hygiene` checks, an up-to-date
branch, and resolved conversations, including for administrators. It prohibits
force pushes and deletion. Zero approvals allows a solo maintainer to merge their
own PR after checks; it does not require a second maintainer who may not exist.
Confirm the actual successful check names before applying and read all settings
back afterward. Scheduled live-spec drift is diagnostic, not a required PR check.

## npm prerequisites

The current root pin is **0.6**, superseding the old 0.5 release checklist.
Anonymous registry requests returned 404 for all current versions:

| Package | Version |
| --- | --- |
| `@cueframe/api-contract` | `2.1.0` |
| `@cueframe/sdk` | `0.5.0` |
| `@cueframe/skills` | `0.1.2` |
| `cueframe` | `0.6.0` |

The public CLI latest tag still resolves to 0.4.10. A 404 means unavailable to an
anonymous consumer; it does not establish whether a restricted version exists.

`pnpm check:public-packages` checks exact source versions and tarball access
without reading npm configuration or credentials. It deliberately fails today.
It runs after publishing, not in the prepublication CI that must pass before
those versions can exist. The existing pack/install smoke validates unpublished
tarballs in an empty consumer before publication.

The skills package's future publish configuration is public. This does not change
an existing restricted package. At the authorized package release, check existing
version ownership/content first, bump any already-published version whose bytes
would change, and explicitly change existing skills access if needed:

```sh
npm access set status=public @cueframe/skills
```

This exposes **existing package versions**, so it belongs to the publication step
after their content has been cleared, not an automatic build or validation step.
No npm package or access setting was changed during this review.

The publisher now waits for the complete reusable CI workflow, then publishes in
dependency order and verifies anonymous availability. New versions published after
the source repository becomes public request npm provenance automatically. Versions
published while it is private cannot gain provenance retroactively; publish a new
version after the switch if provenance is required. No workflow was dispatched.

Sources: [GitHub security settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository),
[npm provenance](https://docs.npmjs.com/generating-provenance-statements/).

## Local validation

After integrating current main and the readiness changes, `pnpm check`,
`pnpm build`, and `pnpm test` passed in order (83 SDK tests, 238 CLI tests,
50 tooling tests). Generated API consumer drift verification and actionlint
passed. OpenAI artifact generation and content verification passed.

All four packed packages installed in an empty consumer; published entry points,
55 request-body schema exports, the CLI help command, and all 18 bundled skills
passed the smoke checks. The system temporary disk was full, so the successful
smoke used temporary files and npm cache on the workspace drive. This verifies
local release tarballs, not public npm availability or fresh-host OAuth.
