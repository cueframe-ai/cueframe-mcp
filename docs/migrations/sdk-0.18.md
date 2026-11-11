# Migrating to SDK 0.18

SDK 0.18 is a breaking release of `@cueframe/sdk` while the package is below 1.0.
It regenerates client types and Zod schemas from the current API projection.
The API contract correction is planned as 7.0.3; the CLI bundles the updated SDK
in a patch release because its commands, flags and public output are unchanged.
The CLI remains on the 0.12 installation line.

## Removed generated constants

The following named exports are no longer available from `@cueframe/sdk/zod`.
Remove these imports before upgrading. If application UI needs a page-size cap,
keep the endpoint's documented cap in application configuration instead of
importing a constant emitted by the schema generator. The service still applies
its documented endpoint-specific defaults and clamping.

| Removed export | Documented cap |
| --- | ---: |
| `getUsageQueryLimitMax` | 100 |
| `listBrandKitsQueryLimitMax` | 100 |
| `listBriefsQueryLimitMax` | 100 |
| `listCheckpointsQueryLimitMax` | 100 |
| `listMediaSuggestionsQueryLimitMax` | 100 |
| `listCatalogQueryLimitMax` | 100 |
| `listMediaQueryLimitMax` | 100 |
| `listProjectsQueryLimitMax` | 100 |
| `listProjectRendersQueryLimitMax` | 100 |
| `listSessionsQueryLimitMax` | 100 |
| `listTemplatesQueryLimitMax` | 100 |
| `listWebhooksQueryLimitMax` | 100 |

For example, an application importing `listProjectsQueryLimitMax` must replace
that import with its own project page-size configuration (the documented cap
is 100). Do not restore exports by editing generated SDK files.

## Pagination parser output types

Several generated pagination `limit` fields and their Zod parser outputs now
have type `unknown` instead of `number`. The projection describes the API's
existing tolerant query input; generated parsing does not promise a numeric
output for an arbitrary query value. Code that performs arithmetic on a parsed
limit must first validate or narrow it to a number. Prefer an application-owned
numeric input validator for a page-size control, or pass the query value to the
service and use its documented defaults and clamping. Never cast an unvalidated
value to `number` to bypass this change.

The response-side account model also includes `userId`; update locally
constructed `AccountResponse` fixtures accordingly. These changes do not add or
remove REST operations or change the scene schema and examples.
