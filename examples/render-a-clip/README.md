# Render a clip with the SDK

`run.mjs` creates a project, imports a ten-second public sample (Big Buck Bunny, CC BY), waits for processing, adds one `clip.add` operation, renders, and prints the MP4 URL. It reads `CUEFRAME_API_KEY` from the environment and exits non-zero on any API error with the error envelope printed.

Requires **Node.js 24 or newer**.

```bash
npm install
CUEFRAME_API_KEY=cf_test_… node run.mjs
```

Rendering and media processing are metered against the account's credit wallet; the script prints the balance before and after. Check [cloud rates](https://cueframe.ai/pricing) before running it. This example has no recorded production render result. The [API walkthrough](https://cueframe.ai/api) shows the Yosemite workflow and its output.
