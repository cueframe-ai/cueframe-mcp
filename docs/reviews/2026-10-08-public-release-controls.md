# Public repository controls

Checked October 9, 2026. These settings apply to the public CueFrame toolkit repository.

## Changes to main

Main requires a pull request and resolved review conversations, including for administrators. No approvals are required because the project currently has one maintainer. Force pushes and branch deletion are blocked.

GitHub Actions is disabled. Before merging a change, run `pnpm check`, `pnpm build` and `pnpm test`, in that order. The workflows are available if automated checks are enabled later.

The expected branch policy is recorded in `.github/release-main-protection.json`. GitHub settings must be updated separately.

## Security

Private vulnerability reporting, dependency alerts, secret scanning and push protection are enabled. Report vulnerabilities through the process in [SECURITY.md](../../SECURITY.md).

## Packages and plugin

Anonymous downloads were verified for `@cueframe/api-contract` 3.0.1, `@cueframe/sdk` 0.6.2, `@cueframe/skills` 0.2.2 and `cueframe` 0.8.1. Installation instructions use `cueframe@0.8`. The plugin version comes from `packages/skills/package.json`; package versions are independent.

[Release v0.2.2](https://github.com/cueframe-ai/cueframe-mcp/releases/tag/v0.2.2) includes a hook-free OpenAI plugin ZIP. Its manifest records the source commit.

## Release checks

A fresh clone passed installation with the frozen lockfile, then check, build and test using Node 24 and pnpm 10.32.1. The working tree stayed clean. A full-history Gitleaks scan found no credentials, and fixtures were reviewed for confidential data.

For connection instructions, see the [setup guide](https://docs.cueframe.ai/docs/setup). To make your first video, follow the [first-render walkthrough](https://cueframe.ai/start).
