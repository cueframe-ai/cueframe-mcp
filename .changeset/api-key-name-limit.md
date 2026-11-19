---
"@cueframe/api-contract": major
"@cueframe/sdk": minor
"cueframe": patch
---

Breaking: API key creation names are limited to 32 characters in the public contract. The SDK's generated Zod validators now reject longer names locally, matching the existing server limit.
