# Public repository controls

Updated October 9, 2026 after creating a fresh repository and making it public. The previous repository remains privately archived. This document describes the public toolkit repository, not the application repository or its packages.

## Verified GitHub settings

- Repository visibility: public; default branch: main.
- Main requires a pull request and resolved conversations, including for administrators. Zero required approvals supports a solo maintainer while preserving the PR workflow.
- Force pushes and branch deletion are prohibited.
- GitHub private vulnerability reporting, dependency vulnerability alerts, secret scanning, and push protection are enabled.
- GitHub Actions remains disabled by maintainer choice. No automated status checks are required while disabled; local validation and review are necessary before merging. The prepared protection payload matches this setting, rather than requiring checks that cannot run.
- The existing workflows use pinned action SHAs and fork-safe read-only PR jobs. They are not execution evidence while Actions is disabled.

The main policy is recorded in `.github/release-main-protection.json`, and secret protection in `.github/release-secret-protection.json`. Verify live API settings after applying these payloads; files alone do not enable controls. If automated checks are enabled in the future, verify real passing job names before making them required.

## Packages and plugin

Anonymous metadata and tarball access passed for @cueframe/api-contract 3.0.1, @cueframe/sdk 0.6.2, @cueframe/skills 0.2.2, and cueframe 0.8.1. The CLI documentation pin is 0.8. Package versions are independent; the agent plugin version is derived from packages/skills/package.json.

The GitHub release [v0.2.2](https://github.com/cueframe-ai/cueframe-mcp/releases/tag/v0.2.2) supplies a validated hook-free plugin ZIP for the OpenAI/Codex submission path. Its content-addressed release manifest identifies the source commit. Publishing the artifact does not imply any directory has approved it. No npm access changes or application-package publication were needed for this repository visibility change.

## Verification

A clean external clone passed frozen-lockfile installation, pnpm check, pnpm build, and pnpm test in that order with Node 24 and pnpm 10.32.1. The tracked working tree stayed clean. Full-history Gitleaks scanning found no credentials; fixtures were reviewed for confidential data. The final discovery updates also passed check/build/test and plugin artifact generation/verification.

Fresh-host OAuth and runtime checks across every advertised client remain distinct acceptance work. A working production MCP video flow does not prove every host integration or directory review.

## Discovery

GitHub About metadata, topics, README imagery, host-manifest keywords, and llms.txt provide product and agent entry points. Existing registry listings, submitted forms, curated-list pull requests, and access blockers are tracked in the [public directory submission issue](https://github.com/cueframe-ai/cueframe-mcp/issues/4). Always distinguish submitted, accepted, and searchable.
