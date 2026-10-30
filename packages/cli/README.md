# cueframe

Agent-native CLI for **CueFrame** — turn media into rendered video from the
terminal. Commands support `--json` for structured output and the binary
self-describes via `npx -y cueframe@0.11 describe --json`, so agents can drive it without
guesswork.

> Connects to the hosted CueFrame service — create an API key at
> [app.cueframe.ai](https://app.cueframe.ai), or use `npx -y cueframe@0.11 login`.

## Run it

Run the CLI without a global installation:

```bash
npx -y cueframe@0.11 --help
```

Requires **Node.js 24 or newer**. The `@0.8` selector keeps these commands on the documented minor release. `npx` downloads the package into its cache; it does not install a persistent binary on your `PATH`.

For repeated terminal use, you can install that release globally:

```bash
npm install -g cueframe@0.11
```

The same commands then run as `cueframe …`.

## Authenticate

```bash
npx -y cueframe@0.11 auth <cf_live_… key>        # static API key (CI / headless)
# or
npx -y cueframe@0.11 login                       # OAuth device flow (browser)
```

The key can also be supplied via the `CUEFRAME_API_KEY` environment variable.

## Check your connection

```bash
npx -y cueframe@0.11 api GET /v1/me --json
```

This reads your account and credit entitlements without rendering. Cloud processing and rendering consume credits; see [cloud rates](https://cueframe.ai/pricing).

For a bounded operation that needs a longer client wait, `api` accepts an explicit
`--timeout-ms <milliseconds>` integer from 1 to 2147483647. Omitting it preserves
the SDK default. This changes only the request wait; server deadlines and operation
outcomes remain authoritative. After a timeout, inspect the saved outcome before
retrying a write, and retain its original command identity.

## Quick start — upload → author → render

To compare an exact certified reference frame with an existing composition preview:

```bash
npx -y cueframe@0.11 compare <projectId> --reference-media <mediaId> --reference-representation <identity> --reference-frame 117 --candidate-job <jobId> --candidate-artifact <artifactId> --out ./comparison --json
```

This uses the shared comparison operation without rendering the composition again. The default views are side-by-side and an unaligned 50% overlay. Select `--views overlay,difference` or one shared-coordinate `--crop x,y,width,height` when useful. `--out` saves verified PNGs; NDJSON reports compact source and image receipts. Without `--out`, receipts describe the images but do not save them. These diagnostics do not replace motion or sound review.

```bash
# 1. Register media (video / image / audio)
npx -y cueframe@0.11 upload ./source.mp4 --json              # → mediaItemId

# 2. Create a project (sets aspect / format)
npx -y cueframe@0.11 project create -n promo -a 9:16 --json  # → projectId

# 3. Author the composition — tracks of clips, per-clip reframe/trim,
#    optional captions. The composition is the source of truth. A put needs the
#    ETag your edit started from (`composition get`), or --create for the first one.
npx -y cueframe@0.11 composition put <projectId> -b @composition.json --if-match <etag>

# 4. Render the saved composition to MP4 (queues, SSE-watches, downloads)
npx -y cueframe@0.11 render <projectId> -o out.mp4 --json
```

`render` takes only a project id and renders whatever composition is saved on
it — no clip suggestion required. Run `npx -y cueframe@0.11 describe --json` for command arguments and options. See the [API reference](https://docs.cueframe.ai/docs/api) for composition fields.

## Let CueFrame pick the clip (podcast → short)

```bash
npx -y cueframe@0.11 upload ./long.mp4 --analyze --json                 # media + AI clip suggestions
npx -y cueframe@0.11 clips <mediaItemId> --json                         # list suggestions (sug_…)
npx -y cueframe@0.11 project create -n short -a 9:16 --from-suggestion <sug_…> --json
npx -y cueframe@0.11 render <projectId> -o short.mp4 --json
```

Both paths converge on `render`; the suggestion on-ramp just authors the
composition for you instead of you hand-writing it.

## Run a template

A template is one `.cueframe` document: a composition with `{{name}}`
references, the parameters that fill them, optional presets and brand kits.
The public catalog lives in `cueframe-ai/cueframe-templates`; your org keeps
its own under `POST /v1/templates`.

```bash
npx -y cueframe@0.11 template run yosemite-warp-text --preset granite --media source=sample --values text=CARVED -o carved.mp4
npx -y cueframe@0.11 template run ./template.cueframe --media source=./clip.mp4 --values title="Journey" --no-render --json
npx -y cueframe@0.11 template status <jobId> --wait --json       # reconnect to a running preparation
npx -y cueframe@0.11 template validate ./template.cueframe          # on the API with your key; nothing is stored
```

`run` publishes a local document to your org (a catalog slug is imported on
first use), uploads each `--media name=<file>`, then starts one preparation job.
The job imports and processes media, attaches verified template assets, applies
the composition, and returns the ready project before `run` renders it. The
`template_job_request` JSON event carries an idempotency key; pass it back with
`--idempotency-key` if the start request loses its response. Reuse the same
media IDs from the earlier upload events as `--media name=media:<id>` so the
retried request has identical inputs. After a `jobId` arrives,
`template status <jobId> --wait` reconnects without starting another project.
`--media name=<https url>` imports the
URL, `--media name=sample` takes the template's own sample. `--values` are
coerced to the document's parameter types before anything is sent; whether a
value fits (an enum option, a number in range) is the server's verdict, which
`--dry-run` fetches without storing anything.

`validate` runs on the CueFrame API with your key and stores nothing. It exits
2 with the problems the server returns: undeclared or misplaced references, a
preset that does not bind, a required media parameter with no sample, a
prepared matte at another bake version.

## Wire it into your agents

```bash
npx -y cueframe@0.11 install
```

Detects supported local agents and adds `https://api.cueframe.ai/v1/mcp` to their configuration. It also copies the bundled skills to `~/.agents/skills` and `~/.claude/skills`, preserving locally changed skills by default. This can update multiple detected clients; inspect the changes first:

```bash
npx -y cueframe@0.11 install --dry-run --json
```

Restart your agent session after installation. Interactive MCP clients open a browser to authorize on the first call. ChatGPT uses its hosted connector setup separately; see the [connection guide](https://docs.cueframe.ai/docs/setup).

## For agents

- **`--json`** — lifecycle events use NDJSON: `<verb>_prepare → <verb>_progress* → <verb>_complete | error`, plus a non-zero exit on failure.
- **`npx -y cueframe@0.11 describe --json`** — the full command tree as structured JSON.
- **`npx -y cueframe@0.11 api <METHOD> <path>`** — raw escape hatch over the v1 API.

## Common commands

| Need to… | Command |
|---|---|
| List projects | `npx -y cueframe@0.11 list` |
| Read a composition + ETag | `npx -y cueframe@0.11 composition get <projectId> --json` |
| Write a composition | `npx -y cueframe@0.11 composition put <projectId> -b @comp.json --if-match <etag>` (`--create` for a project's first composition) |
| Export to Final Cut / Premiere | `npx -y cueframe@0.11 export fcpxml \| premiere <projectId> -s <sug_…> --wait -o cut.zip` |
| Validate without mutating | use `--dry-run` where command help lists it |

## Render existing projects from a script

After authentication, render each saved project in sequence. This uses the existing composition and downloads the MP4; it does not create an edit. Each render is metered.

```bash
set -e
for project_id in "$@"; do
  npx -y cueframe@0.11 render "$project_id" -o "${project_id}.mp4" --json
done
```

Save this as `render-projects.sh` and pass project IDs: `bash render-projects.sh PROJECT_ID_1 PROJECT_ID_2`. `set -e` stops the batch on a failed command. Lifecycle output is NDJSON, so consume one JSON object per line. Check [the API quickstart](https://cueframe.ai/api.md) for retrieving an existing render job after an interrupted connection; do not submit a new render merely to check its status.
---

© CueFrame, Inc. Open source under Apache-2.0.
