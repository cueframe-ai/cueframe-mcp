# Changesets

Every pull request that changes a published package adds one file here, written with
`pnpm changeset` (or by hand):

```md
---
"@cueframe/sdk": minor
---

What changed, in one or two sentences, for the package's CHANGELOG.
```

The bump level follows the change: `major` for a breaking change (`minor` while the package is
below 1.0), `minor` for a new feature, `patch` for a fix. `pnpm check:changesets` fails a pull
request that changes a package's files without one, and one that edits a `version` field by hand.

On merge to `main`, `.github/workflows/publish-npm.yml` runs `changeset version`, commits the bump
and publishes. Nobody edits `version` in a `package.json`.
