# Render a clip with the SDK

`run.mjs` creates a project, imports a ten-second public sample (Big Buck Bunny, CC BY), waits for processing, adds one `clip.add` operation, renders, and prints the MP4 URL. It reads `CUEFRAME_API_KEY` from the environment and exits non-zero on any API error with the error envelope printed.

```
npm install
CUEFRAME_API_KEY=cf_test_… node run.mjs
```

Rendering is metered against the account's credit wallet; the script prints the balance before and after. Output of the last run:

```
pending: run against a test key
```
